import Database from '@tauri-apps/plugin-sql';

const DB_NAME = 'gallery.db';

export interface CachedTranslation {
    id?: number;
    file_path: string;
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
    translated_text: string;
    language: string;
    created_at?: string;
}

class DatabaseService {
    private db: Database | null = null;

    async init() {
        if (this.db) return;

        // Check if running in Tauri environment
        if (!("__TAURI_INTERNALS__" in window)) {
            console.warn("Not running in Tauri. Database disabled.");
            return;
        }

        try {
            this.db = await Database.load(`sqlite:${DB_NAME}`);
            await this.createTables();
        } catch (e) {
            console.error("Failed to load database:", e);
        }
    }

    private async createTables() {
        if (!this.db) return;
        await this.db.execute(`
            CREATE TABLE IF NOT EXISTS translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                w INTEGER NOT NULL,
                h INTEGER NOT NULL,
                text TEXT,
                translated_text TEXT,
                language TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Index for faster lookups by file path
        await this.db.execute(`
            CREATE INDEX IF NOT EXISTS idx_file_path ON translations(file_path);
        `);
    }

    async saveTranslation(translation: CachedTranslation) {
        if (!this.db) await this.init();
        if (!this.db) return;

        try {
            await this.db.execute(
                `INSERT INTO translations (file_path, x, y, w, h, text, translated_text, language) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    translation.file_path,
                    Math.round(translation.x),
                    Math.round(translation.y),
                    Math.round(translation.w),
                    Math.round(translation.h),
                    translation.text,
                    translation.translated_text,
                    translation.language
                ]
            );
        } catch (e) {
            console.error("Failed to save translation:", e);
        }
    }

    async getTranslationsForFile(filePath: string): Promise<CachedTranslation[]> {
        if (!this.db) await this.init();
        if (!this.db) return [];

        try {
            return await this.db.select<CachedTranslation[]>(
                `SELECT * FROM translations WHERE file_path = $1`,
                [filePath]
            );
        } catch (e) {
            console.error("Failed to get translations:", e);
            return [];
        }
    }

    async deleteTranslation(id: number) {
        if (!this.db) await this.init();
        if (!this.db) return;

        try {
            await this.db.execute(`DELETE FROM translations WHERE id = $1`, [id]);
        } catch (e) {
            console.error("Failed to delete translation:", e);
        }
    }
}

export const dbService = new DatabaseService();
