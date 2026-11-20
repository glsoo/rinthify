// macos version of inject/linux/rinthify.c, loaded with DYLD_INSERT_LIBRARIES
// cc -dynamiclib -fobjc-arc -o librinthify.dylib rinthify.m -framework WebKit -framework UniformTypeIdentifiers
#import <WebKit/WebKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <objc/runtime.h>

static NSString *userDir;
static NSString *script;
static NSString *cli;
static BOOL safe;

@interface RinthifyHandler : NSObject <WKScriptMessageHandlerWithReply>
@property(weak) WKWebView *view;
@end

// relative path to full path, nil if unsafe
static NSString *resolvePath(NSString *rel) {
	if (![rel isKindOfClass:NSString.class] || !rel.length || !userDir.length || [rel containsString:@"\\"]) return nil;
	for (NSString *p in [rel componentsSeparatedByString:@"/"])
		if (!p.length || [p isEqual:@"."] || [p isEqual:@".."]) return nil;
	return [userDir stringByAppendingPathComponent:rel];
}

static BOOL writeFile(NSString *full, NSData *data, NSError **e) {
	[NSFileManager.defaultManager createDirectoryAtPath:full.stringByDeletingLastPathComponent withIntermediateDirectories:YES attributes:nil error:nil];
	return [data writeToFile:full options:NSDataWritingAtomic error:e];
}

@implementation RinthifyHandler
- (void)userContentController:(WKUserContentController *)ucc
      didReceiveScriptMessage:(WKScriptMessage *)message
                 replyHandler:(void (^)(id, NSString *))reply {
	NSDictionary *msg = [message.body isKindOfClass:NSDictionary.class] ? message.body : @{};
	NSString *op = msg[@"op"], *rel = msg[@"path"], *data = msg[@"data"];
	if (![data isKindOfClass:NSString.class]) data = nil;
	if (![rel isKindOfClass:NSString.class]) rel = nil;
	NSString *full = resolvePath(rel);
	NSFileManager *fm = NSFileManager.defaultManager;
	NSError *e = nil;

	if (![op isKindOfClass:NSString.class]) return reply(nil, @"missing op");
	if ([op isEqual:@"log"]) {
		fprintf(stderr, "[rinthify] %s\n", (data ?: @"").UTF8String);
		return reply(NSNull.null, nil);
	}
	if ([op isEqual:@"eval"]) {
		// void 0 because returning a promise errors
		if (!data) return reply(nil, @"missing data");
		NSString *code = [NSString stringWithFormat:@"%@\n;void 0\n//# sourceURL=%@", data, rel ?: @"rinthify"];
		return [self.view evaluateJavaScript:code completionHandler:^(id r, NSError *err) {
			reply(err ? nil : NSNull.null, err ? err.localizedDescription : nil);
		}];
	}
	if ([op isEqual:@"fetch"]) {
		// download past the csp
		NSURL *url = [data hasPrefix:@"https://"] ? [NSURL URLWithString:data] : nil;
		if (!url) return reply(nil, @"bad url");
		if (rel && !full) return reply(nil, [@"bad path: " stringByAppendingString:rel]);
		NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestUseProtocolCachePolicy timeoutInterval:30];
		[req setValue:@"Rinthify" forHTTPHeaderField:@"User-Agent"];
		NSString *method = msg[@"method"], *body = msg[@"body"];
		if ([body isKindOfClass:NSString.class]) {
			req.HTTPBody = [body dataUsingEncoding:NSUTF8StringEncoding];
			req.HTTPMethod = @"POST";
			[req setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
		}
		if ([method isKindOfClass:NSString.class]) req.HTTPMethod = method;
		NSDictionary *headers = msg[@"headers"];
		if ([headers isKindOfClass:NSDictionary.class])
			for (NSString *k in headers)
				if ([headers[k] isKindOfClass:NSString.class]) [req setValue:headers[k] forHTTPHeaderField:k];
		[[NSURLSession.sharedSession dataTaskWithRequest:req completionHandler:^(NSData *body, NSURLResponse *res, NSError *err) {
			NSInteger status = [res isKindOfClass:NSHTTPURLResponse.class] ? ((NSHTTPURLResponse *)res).statusCode : 0;
			NSString *fail = err ? err.localizedDescription : status >= 300 ? [NSString stringWithFormat:@"HTTP %ld", (long)status] : nil;
			id value = NSNull.null;
			NSError *we = nil;
			if (!fail && full && !writeFile(full, body ?: NSData.data, &we)) fail = we.localizedDescription;
			else if (!fail && !full) value = [[NSString alloc] initWithData:body ?: NSData.data encoding:NSUTF8StringEncoding] ?: @"";
			dispatch_async(dispatch_get_main_queue(), ^{ reply(fail ? nil : value, fail); });
		}] resume];
		return;
	}
	if ([op isEqual:@"run"]) {
		// update, inject (repair) or uninject
		if (!cli || ![@[ @"update", @"inject", @"uninject" ] containsObject:data ?: @""]) return reply(nil, @"bad command");
		NSTask *t = [NSTask new];
		NSPipe *pipe = [NSPipe pipe];
		t.executableURL = [NSURL fileURLWithPath:cli];
		t.arguments = @[ data ];
		t.standardOutput = t.standardError = pipe;
		if (![t launchAndReturnError:&e]) return reply(nil, e.localizedDescription);
		dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
			NSString *out = [[NSString alloc] initWithData:[pipe.fileHandleForReading readDataToEndOfFile] encoding:NSUTF8StringEncoding] ?: @"";
			[t waitUntilExit];
			BOOL ok = t.terminationStatus == 0;
			dispatch_async(dispatch_get_main_queue(), ^{ reply(ok ? out : nil, ok ? nil : (out.length ? out : @"failed")); });
		});
		return;
	}
	if ([op isEqual:@"list"]) {
		// "mtime_ms\trelative/path" for every file
		NSMutableArray *out = [NSMutableArray array];
		NSDirectoryEnumerator *it = [fm enumeratorAtPath:userDir ?: @""];
		for (NSString *r in it) {
			NSDictionary *a = it.fileAttributes;
			if (![a.fileType isEqual:NSFileTypeRegular]) continue;
			[out addObject:[NSString stringWithFormat:@"%lld\t%@", (long long)(a.fileModificationDate.timeIntervalSince1970 * 1000), r]];
		}
		return reply(out, nil);
	}
	if (!full) return reply(nil, [@"bad path: " stringByAppendingString:rel ?: @"(none)"]);
	if ([op isEqual:@"read"]) {
		NSString *text = [NSString stringWithContentsOfFile:full encoding:NSUTF8StringEncoding error:&e];
		return text ? reply(text, nil) : reply(nil, e.localizedDescription);
	}
	if ([op isEqual:@"image"]) {
		// file as a data url
		NSData *bytes = [NSData dataWithContentsOfFile:full options:0 error:&e];
		if (!bytes) return reply(nil, e.localizedDescription);
		NSString *mime = [UTType typeWithFilenameExtension:full.pathExtension].preferredMIMEType ?: @"application/octet-stream";
		return reply([NSString stringWithFormat:@"data:%@;base64,%@", mime, [bytes base64EncodedStringWithOptions:0]], nil);
	}
	if ([op isEqual:@"write"]) {
		// base64 for binary files
		NSData *bytes = [msg[@"base64"] boolValue] ? [[NSData alloc] initWithBase64EncodedString:data ?: @"" options:0] : [data ?: @"" dataUsingEncoding:NSUTF8StringEncoding];
		if (!bytes) return reply(nil, @"bad base64");
		return writeFile(full, bytes, &e) ? reply(NSNull.null, nil) : reply(nil, e.localizedDescription);
	}
	if ([op isEqual:@"delete"]) {
		if (![fm removeItemAtPath:full error:&e] && e.code != NSFileNoSuchFileError) return reply(nil, e.localizedDescription);
		return reply(NSNull.null, nil);
	}
	reply(nil, [@"unknown op: " stringByAppendingString:op]);
}
@end

// add the loader and bridge before the web view is made
static id (*realInit)(id, SEL, CGRect, WKWebViewConfiguration *);
static id hookedInit(WKWebView *self, SEL sel, CGRect frame, WKWebViewConfiguration *conf) {
	WKUserContentController *ucc = conf.userContentController;
	RinthifyHandler *handler = nil;
	if (script && !objc_getAssociatedObject(ucc, "rinthify")) {
		fprintf(stderr, "[rinthify] injecting into the web view\n");
		handler = [RinthifyHandler new];
		objc_setAssociatedObject(ucc, "rinthify", handler, OBJC_ASSOCIATION_RETAIN);
		NSData *dirJson = [NSJSONSerialization dataWithJSONObject:@[ userDir ?: @"" ] options:0 error:nil];
		NSString *dirArr = [[NSString alloc] initWithData:dirJson encoding:NSUTF8StringEncoding];
		NSString *src = [NSString stringWithFormat:@"window.__RINTHIFY__={dir:%@[0],safeMode:%@};\n%@", dirArr, safe ? @"true" : @"false", script];
		[ucc addUserScript:[[WKUserScript alloc] initWithSource:src injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
		[ucc addScriptMessageHandlerWithReply:handler contentWorld:WKContentWorld.pageWorld name:@"rinthify"];
		// debug: web inspector (Safari > Develop)
		if (getenv("RINTHIFY_DEBUG")) [conf.preferences setValue:@YES forKey:@"developerExtrasEnabled"];
	}
	WKWebView *view = realInit(self, sel, frame, conf);
	if (handler) handler.view = view;
	return view;
}

// read and clear our env vars so games dont get them
__attribute__((constructor)) static void init(void) {
	const char *dir = getenv("RINTHIFY_DIR"), *js = getenv("RINTHIFY_SCRIPT"), *s = getenv("RINTHIFY_SAFE");
	userDir = dir ? @(dir) : @"";
	safe = s && *s && strcmp(s, "0") != 0;
	if (js) cli = [@(js).stringByDeletingLastPathComponent stringByAppendingPathComponent:@"rinthify"];
	if (js && !(script = [NSString stringWithContentsOfFile:@(js) encoding:NSUTF8StringEncoding error:nil]))
		fprintf(stderr, "[rinthify] cannot read %s\n", js);
	unsetenv("DYLD_INSERT_LIBRARIES");
	unsetenv("RINTHIFY_SCRIPT");
	Method m = class_getInstanceMethod(WKWebView.class, @selector(initWithFrame:configuration:));
	realInit = (void *)method_setImplementation(m, (IMP)hookedInit);
}
