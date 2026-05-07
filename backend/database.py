import sqlite3
import os

# نضع قاعدة البيانات في المجلد الرئيسي لضمان سهولة الوصول إليها
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "migo_analytics.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS download_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT,
            user_identifier TEXT,
            source_url TEXT,
            display_title TEXT,
            media_type TEXT,
            quality TEXT,
            is_success BOOLEAN,
            error_message TEXT,
            user_agent TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def log_download(ip, user_id, url, title, m_type, quality, success, error=None, ua=None):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        query = '''
            INSERT INTO download_logs 
            (ip_address, user_identifier, source_url, display_title, media_type, quality, is_success, error_message, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        cursor.execute(query, (ip, user_id, url, title, m_type, quality, success, error, ua))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"❌ Database Log Error: {e}")
