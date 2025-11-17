server {
    listen 4433 ssl http2;      # внутренний порт для сайта
    server_name rabota.yo1nk.ru;

    ssl_certificate /etc/letsencrypt/live/rabota.yo1nk.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rabota.yo1nk.ru/privkey.pem;

    # Прокси фронтенд
    location / {
        proxy_pass http://127.0.0.1:8081;   # frontend Docker
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Прокси backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;  # backend Docker
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
