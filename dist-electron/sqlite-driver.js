"use strict";
/**
 * Database driver abstraction.
 *
 * 1. Tries `better-sqlite3` (native module) first.
 * 2. If it is not installed or cannot be loaded (e.g. the native build failed),
 *    falls back to Node's built-in `node:sqlite` (bundled inside Electron, nothing to compile).
 *
 * Both produce the same on-disk SQLite file format, so data is interchangeable.
 * Set CARDEALS_DB_DRIVER=better-sqlite3 | node-sqlite to force one (used by tests).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.openDatabase = openDatabase;
function wrapStatement(stmt) {
    return {
        run: (...p) => {
            const r = stmt.run(...p);
            return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
        },
        get: (...p) => stmt.get(...p),
        all: (...p) => stmt.all(...p),
    };
}
function makeSqlDb(raw, driver) {
    const exec = (sql) => raw.exec(sql);
    exec('PRAGMA journal_mode = WAL');
    exec('PRAGMA foreign_keys = ON');
    let depth = 0;
    return {
        driver,
        exec,
        prepare: (sql) => wrapStatement(raw.prepare(sql)),
        transaction(fn) {
            return () => {
                if (depth > 0)
                    return fn();
                depth++;
                exec('BEGIN');
                try {
                    const out = fn();
                    exec('COMMIT');
                    return out;
                }
                catch (e) {
                    try {
                        exec('ROLLBACK');
                    }
                    catch { /* ignore */ }
                    throw e;
                }
                finally {
                    depth--;
                }
            };
        },
        backupTo(dest) {
            exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
        },
        close: () => raw.close(),
    };
}
function openBetterSqlite3(file) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    return makeSqlDb(new Database(file), 'better-sqlite3');
}
function openNodeSqlite(file) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite');
    return makeSqlDb(new DatabaseSync(file), 'node-sqlite');
}
function openDatabase(file) {
    const forced = process.env.CARDEALS_DB_DRIVER;
    if (forced === 'better-sqlite3')
        return openBetterSqlite3(file);
    if (forced === 'node-sqlite')
        return openNodeSqlite(file);
    try {
        return openBetterSqlite3(file);
    }
    catch (err) {
        console.warn('[db] better-sqlite3 unavailable, using built-in node:sqlite instead:', err.message);
        return openNodeSqlite(file);
    }
}
