//! file access for the rinthify folder

use serde::Serialize;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::Manager;

#[derive(Serialize)]
pub struct Info {
    dir: String,
    safe_mode: bool,
}

#[derive(Serialize)]
pub struct Entry {
    path: String,
    mtime: u64,
}

type Res<T> = Result<T, String>;

fn err(e: impl ToString) -> String {
    e.to_string()
}

/// rinthify folder
fn root(app: &tauri::AppHandle) -> Res<PathBuf> {
    let dir = app.path().config_dir().map_err(err)?.join("rinthify");
    for sub in ["themes", "plugins"] {
        std::fs::create_dir_all(dir.join(sub)).map_err(err)?;
    }
    Ok(dir)
}

/// safe relative path
fn resolve(app: &tauri::AppHandle, rel: &str) -> Res<PathBuf> {
    let p = Path::new(rel);
    if rel.is_empty() || p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err(format!("invalid path: {rel}"));
    }
    Ok(root(app)?.join(p))
}

fn walk(base: &Path, dir: &Path, out: &mut Vec<Entry>) {
    let Ok(read) = std::fs::read_dir(dir) else { return };
    for entry in read.flatten() {
        let path = entry.path();
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            walk(base, &path, out);
        } else if let Ok(rel) = path.strip_prefix(base) {
            let mtime = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |d| d.as_millis() as u64);
            let rel = rel.to_string_lossy().replace('\\', "/");
            out.push(Entry { path: rel, mtime });
        }
    }
}

#[tauri::command]
pub fn rinthify_info(app: tauri::AppHandle) -> Res<Info> {
    Ok(Info {
        dir: root(&app)?.to_string_lossy().into_owned(),
        safe_mode: std::env::var("RINTHIFY_SAFE").is_ok_and(|v| v != "0"),
    })
}

#[tauri::command]
pub fn rinthify_list(app: tauri::AppHandle) -> Res<Vec<Entry>> {
    let base = root(&app)?;
    let mut out = Vec::new();
    walk(&base, &base, &mut out);
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

#[tauri::command]
pub fn rinthify_read(app: tauri::AppHandle, path: String) -> Res<String> {
    std::fs::read_to_string(resolve(&app, &path)?).map_err(err)
}

#[tauri::command]
pub fn rinthify_write(app: tauri::AppHandle, path: String, content: String) -> Res<()> {
    let target = resolve(&app, &path)?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(err)?;
    }
    std::fs::write(target, content).map_err(err)
}

#[tauri::command]
pub fn rinthify_delete(app: tauri::AppHandle, path: String) -> Res<()> {
    let target = resolve(&app, &path)?;
    if target.is_dir() {
        std::fs::remove_dir_all(target).map_err(err)
    } else {
        std::fs::remove_file(target).map_err(err)
    }
}
