// ld_preload lib that adds rinthify to the webview
// cc -shared -fPIC -O2 -o librinthify.so rinthify.c $(pkg-config --cflags --libs webkit2gtk-4.1)
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <glib/gstdio.h>
#include <stdlib.h>
#include <string.h>
#include <libsoup/soup.h>
#include <webkit2/webkit2.h>

static char *user_dir;    // user folder
static char *script;      // loader.js
static gboolean safe;     // safe mode
static char *cli;         // the rinthify script next to loader.js

// read and clear our env vars so games dont get them
__attribute__((constructor)) static void init(void) {
	const char *dir = getenv("RINTHIFY_DIR"), *js = getenv("RINTHIFY_SCRIPT"), *s = getenv("RINTHIFY_SAFE");
	user_dir = g_strdup(dir ? dir : "");
	safe = s && *s && strcmp(s, "0") != 0;
	if (js && !g_file_get_contents(js, &script, NULL, NULL)) g_printerr("[rinthify] cannot read %s\n", js);
	if (js) {
		char *d = g_path_get_dirname(js);
		cli = g_build_filename(d, "rinthify", NULL);
		g_free(d);
	}
	unsetenv("LD_PRELOAD");
	unsetenv("RINTHIFY_SCRIPT");
}

// relative path to full path, null if unsafe
static char *resolve(const char *rel) {
	if (!rel || !*rel || !*user_dir || strchr(rel, '\\')) return NULL;
	char **parts = g_strsplit(rel, "/", -1);
	gboolean ok = TRUE;
	for (char **p = parts; *p; p++)
		if (!**p || !strcmp(*p, ".") || !strcmp(*p, "..")) ok = FALSE;
	g_strfreev(parts);
	return ok ? g_build_filename(user_dir, rel, NULL) : NULL;
}

// list files with mtimes
static void list_dir(const char *dir, const char *rel, GPtrArray *out) {
	GDir *d = g_dir_open(dir, 0, NULL);
	if (!d) return;
	for (const char *name; (name = g_dir_read_name(d));) {
		char *full = g_build_filename(dir, name, NULL);
		char *r = *rel ? g_strconcat(rel, "/", name, NULL) : g_strdup(name);
		GStatBuf st;
		if (g_stat(full, &st) == 0) {
			if (S_ISDIR(st.st_mode)) list_dir(full, r, out);
			else if (S_ISREG(st.st_mode))
				g_ptr_array_add(out, g_strdup_printf("%lld\t%s",
					(long long)st.st_mtim.tv_sec * 1000 + st.st_mtim.tv_nsec / 1000000, r));
		}
		g_free(full);
		g_free(r);
	}
	g_dir_close(d);
}

static int remove_all(const char *path) {
	GDir *d = g_dir_open(path, 0, NULL);
	if (!d) return g_unlink(path);
	for (const char *name; (name = g_dir_read_name(d));) {
		char *full = g_build_filename(path, name, NULL);
		remove_all(full);
		g_free(full);
	}
	g_dir_close(d);
	return g_rmdir(path);
}

static char *prop(JSCValue *obj, const char *key) {
	JSCValue *v = jsc_value_object_get_property(obj, key);
	char *s = jsc_value_is_string(v) ? jsc_value_to_string(v) : NULL;
	g_object_unref(v);
	return s;
}

// eval reply
static void on_eval_done(GObject *view, GAsyncResult *res, gpointer reply) {
	GError *e = NULL;
	JSCValue *v = webkit_web_view_evaluate_javascript_finish(WEBKIT_WEB_VIEW(view), res, &e);
	if (e) {
		webkit_script_message_reply_return_error_message(reply, e->message);
		g_error_free(e);
	} else {
		JSCValue *n = jsc_value_new_null(jsc_value_get_context(v));
		webkit_script_message_reply_return_value(reply, n);
		g_object_unref(n);
		g_object_unref(v);
	}
	webkit_script_message_reply_unref(reply);
}

// pending fetch or run
typedef struct {
	char *full;
	JSCContext *ctx;
	WebKitScriptMessageReply *reply;
} Fetch;

// fetch reply
static void on_fetch_done(GObject *session, GAsyncResult *res, gpointer data) {
	Fetch *f = data;
	GError *e = NULL;
	GBytes *body = soup_session_send_and_read_finish(SOUP_SESSION(session), res, &e);
	SoupMessage *msg = soup_session_get_async_result_message(SOUP_SESSION(session), res);
	guint status = msg ? soup_message_get_status(msg) : 0;
	char *err = e ? g_strdup(e->message) : status >= 300 ? g_strdup_printf("HTTP %u", status) : NULL;
	JSCValue *result = NULL;
	if (!err) {
		gsize len;
		const char *bytes = g_bytes_get_data(body, &len);
		if (f->full) {
			char *parent = g_path_get_dirname(f->full);
			g_mkdir_with_parents(parent, 0755);
			if (!g_file_set_contents(f->full, bytes ? bytes : "", len, &e)) err = g_strdup(e->message);
			g_free(parent);
		} else {
			char *text = g_strndup(bytes ? bytes : "", len);
			webkit_script_message_reply_return_value(f->reply, result = jsc_value_new_string(f->ctx, text));
			g_free(text);
		}
	}
	if (err) webkit_script_message_reply_return_error_message(f->reply, err);
	else if (!result) webkit_script_message_reply_return_value(f->reply, result = jsc_value_new_null(f->ctx));
	if (result) g_object_unref(result);
	if (e) g_error_free(e);
	if (body) g_bytes_unref(body);
	webkit_script_message_reply_unref(f->reply);
	g_object_unref(f->ctx);
	g_free(f->full), g_free(err), g_free(f);
}

// run reply, the output either way
static void on_run_done(GObject *proc, GAsyncResult *res, gpointer data) {
	Fetch *f = data;
	GError *e = NULL;
	char *out = NULL;
	if (g_subprocess_communicate_utf8_finish(G_SUBPROCESS(proc), res, &out, NULL, &e) && !g_subprocess_get_successful(G_SUBPROCESS(proc)))
		webkit_script_message_reply_return_error_message(f->reply, out && *out ? out : "failed");
	else if (e) webkit_script_message_reply_return_error_message(f->reply, e->message);
	else {
		JSCValue *v = jsc_value_new_string(f->ctx, out ? out : "");
		webkit_script_message_reply_return_value(f->reply, v);
		g_object_unref(v);
	}
	if (e) g_error_free(e);
	webkit_script_message_reply_unref(f->reply);
	g_object_unref(f->ctx);
	g_free(out), g_free(f);
}

// bridge for the page
static gboolean on_message(WebKitUserContentManager *ucm, JSCValue *msg, WebKitScriptMessageReply *reply, gpointer view) {
	(void)ucm;
	JSCContext *ctx = jsc_value_get_context(msg);
	char *op = prop(msg, "op"), *rel = prop(msg, "path"), *data = prop(msg, "data");
	char *full = resolve(rel), *err = NULL;
	JSCValue *result = NULL;

	if (!op) err = g_strdup("missing op");
	else if (!strcmp(op, "log")) g_printerr("[rinthify] %s\n", data ? data : "");
	else if (!strcmp(op, "eval")) {
		// runs code past the csp
		if (data) {
			webkit_web_view_evaluate_javascript(view, data, -1, NULL, rel, NULL, on_eval_done,
				webkit_script_message_reply_ref(reply));
			g_free(op), g_free(rel), g_free(data), g_free(full);
			return TRUE;
		}
		err = g_strdup("missing data");
	} else if (!strcmp(op, "fetch")) {
		// download past the csp
		static SoupSession *session;
		if (!session) session = soup_session_new_with_options("user-agent", "Rinthify", "timeout", 30, NULL);
		char *method = prop(msg, "method"), *body = prop(msg, "body");
		SoupMessage *m = data && g_str_has_prefix(data, "https://") ? soup_message_new(method ? method : body ? "POST" : "GET", data) : NULL;
		if (m && body) {
			GBytes *b = g_bytes_new_take(body, strlen(body));
			soup_message_set_request_body_from_bytes(m, "application/json", b);
			g_bytes_unref(b), body = NULL;
		}
		// extra headers
		JSCValue *hv = jsc_value_object_get_property(msg, "headers");
		if (m && jsc_value_is_object(hv)) {
			char **keys = jsc_value_object_enumerate_properties(hv);
			for (char **k = keys; k && *k; k++) {
				char *v = prop(hv, *k);
				if (v) soup_message_headers_replace(soup_message_get_request_headers(m), *k, v);
				g_free(v);
			}
			g_strfreev(keys);
		}
		g_object_unref(hv), g_free(method), g_free(body);
		if (!m) err = g_strdup("bad url");
		else if (rel && !full) err = g_strdup_printf("bad path: %s", rel), g_object_unref(m);
		else {
			Fetch *f = g_new0(Fetch, 1);
			f->full = full, full = NULL;
			f->ctx = g_object_ref(ctx);
			f->reply = webkit_script_message_reply_ref(reply);
			soup_session_send_and_read_async(session, m, G_PRIORITY_DEFAULT, NULL, on_fetch_done, f);
			g_object_unref(m);
			g_free(op), g_free(rel), g_free(data);
			return TRUE;
		}
	} else if (!strcmp(op, "run")) {
		// update, inject (repair) or uninject
		GError *e = NULL;
		GSubprocess *p = NULL;
		if (!cli || !data || (strcmp(data, "update") && strcmp(data, "inject") && strcmp(data, "uninject"))) err = g_strdup("bad command");
		else if (!(p = g_subprocess_new(G_SUBPROCESS_FLAGS_STDOUT_PIPE | G_SUBPROCESS_FLAGS_STDERR_MERGE, &e, cli, data, NULL))) {
			err = g_strdup(e->message);
			g_error_free(e);
		} else {
			Fetch *f = g_new0(Fetch, 1);
			f->ctx = g_object_ref(ctx);
			f->reply = webkit_script_message_reply_ref(reply);
			g_subprocess_communicate_utf8_async(p, NULL, NULL, on_run_done, f);
			g_object_unref(p);
			g_free(op), g_free(rel), g_free(data), g_free(full);
			return TRUE;
		}
	} else if (!strcmp(op, "list")) {
		GPtrArray *out = g_ptr_array_new_with_free_func(g_free);
		list_dir(user_dir, "", out);
		g_ptr_array_add(out, NULL);
		result = jsc_value_new_array_from_strv(ctx, (const char *const *)out->pdata);
		g_ptr_array_free(out, TRUE);
	} else if (!full) err = g_strdup_printf("bad path: %s", rel ? rel : "(none)");
	else if (!strcmp(op, "read")) {
		char *text;
		GError *e = NULL;
		if (g_file_get_contents(full, &text, NULL, &e)) {
			result = jsc_value_new_string(ctx, text);
			g_free(text);
		} else {
			err = g_strdup(e->message);
			g_error_free(e);
		}
	} else if (!strcmp(op, "image")) {
		// file as a data url
		gchar *bytes;
		gsize len;
		GError *e = NULL;
		if (g_file_get_contents(full, &bytes, &len, &e)) {
			gchar *type = g_content_type_guess(full, (const guchar *)bytes, len, NULL);
			gchar *mime = g_content_type_get_mime_type(type);
			gchar *b64 = g_base64_encode((const guchar *)bytes, len);
			gchar *url = g_strdup_printf("data:%s;base64,%s", mime ? mime : "application/octet-stream", b64);
			result = jsc_value_new_string(ctx, url);
			g_free(url), g_free(b64), g_free(mime), g_free(type), g_free(bytes);
		} else {
			err = g_strdup(e->message);
			g_error_free(e);
		}
	} else if (!strcmp(op, "write")) {
		char *parent = g_path_get_dirname(full);
		GError *e = NULL;
		gssize len = -1;
		// base64 for binary files
		JSCValue *b64 = jsc_value_object_get_property(msg, "base64");
		if (data && jsc_value_to_boolean(b64)) g_base64_decode_inplace(data, (gsize *)&len);
		g_object_unref(b64);
		g_mkdir_with_parents(parent, 0755);
		if (!g_file_set_contents(full, data ? data : "", len, &e)) {
			err = g_strdup(e->message);
			g_error_free(e);
		}
		g_free(parent);
	} else if (!strcmp(op, "delete")) {
		if (remove_all(full) != 0 && errno != ENOENT) err = g_strdup_printf("delete failed: %s", g_strerror(errno));
	} else err = g_strdup_printf("unknown op: %s", op);

	if (err) webkit_script_message_reply_return_error_message(reply, err);
	else {
		if (!result) result = jsc_value_new_null(ctx);
		webkit_script_message_reply_return_value(reply, result);
	}
	if (result) g_object_unref(result);
	g_free(op), g_free(rel), g_free(data), g_free(full), g_free(err);
	return TRUE;
}

// add the loader and bridge to a webview
static void setup(WebKitWebView *view) {
	if (!script || g_object_get_data(G_OBJECT(view), "rinthify")) return;
	g_object_set_data(G_OBJECT(view), "rinthify", GINT_TO_POINTER(1));
	g_printerr("[rinthify] injecting into the web view\n");
	// debug: print the console
	if (getenv("RINTHIFY_DEBUG")) webkit_settings_set_enable_write_console_messages_to_stdout(webkit_web_view_get_settings(view), TRUE);
	WebKitUserContentManager *ucm = webkit_web_view_get_user_content_manager(view);
	char *dir_json = g_strescape(user_dir, NULL);
	char *src = g_strdup_printf("window.__RINTHIFY__={dir:\"%s\",safeMode:%s};\n%s", dir_json, safe ? "true" : "false", script);
	WebKitUserScript *us = webkit_user_script_new(src, WEBKIT_USER_CONTENT_INJECT_TOP_FRAME,
		WEBKIT_USER_SCRIPT_INJECT_AT_DOCUMENT_START, NULL, NULL);
	webkit_user_content_manager_add_script(ucm, us);
	webkit_user_script_unref(us);
	webkit_user_content_manager_register_script_message_handler_with_reply(ucm, "rinthify", NULL);
	g_signal_connect(ucm, "script-message-with-reply-received::rinthify", G_CALLBACK(on_message), view);
	g_free(dir_json);
	g_free(src);
}

void webkit_web_view_load_uri(WebKitWebView *view, const gchar *uri) {
	static void (*real)(WebKitWebView *, const gchar *);
	if (!real) real = dlsym(RTLD_NEXT, "webkit_web_view_load_uri");
	setup(view);
	real(view, uri);
}

void webkit_web_view_load_request(WebKitWebView *view, WebKitURIRequest *req) {
	static void (*real)(WebKitWebView *, WebKitURIRequest *);
	if (!real) real = dlsym(RTLD_NEXT, "webkit_web_view_load_request");
	setup(view);
	real(view, req);
}
