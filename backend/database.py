import psycopg2
from psycopg2 import sql
import os

# جلب رابط القاعدة من متغيرات البيئة في ريلواي (تلقائي)
# أو ضع الرابط الذي نسخته هنا للتجربة المحلية
DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    return psycopg2.connect(DATABASE_URL, sslmode='require')

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS download_logs (
            id SERIAL PRIMARY KEY,
            ip_address TEXT,
            user_identifier TEXT,
            source_url TEXT,
            display_title TEXT,
            media_type TEXT,
            quality TEXT,
            is_success BOOLEAN,
            error_message TEXT,
            user_agent TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    cursor.close()
    conn.close()

def log_download(ip, user_id, url, title, m_type, quality, success, error=None, ua=None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        query = '''
            INSERT INTO download_logs 
            (ip_address, user_identifier, source_url, display_title, media_type, quality, is_success, error_message, user_agent)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        cursor.execute(query, (ip, user_id, url, title, m_type, quality, success, error, ua))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"❌ PostgreSQL Log Error: {e}")
