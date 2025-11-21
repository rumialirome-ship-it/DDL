# Daily Dubai Lottery Application

This is a full-stack lottery application with a React frontend and an Express.js backend. This guide provides instructions for deploying the application to a Virtual Private Server (VPS).

## Deployment to VPS

Follow these steps to get your application running in a production environment on a Linux-based VPS.

### 1. Prerequisites on the VPS

Ensure you have the following software installed on your server.

-   **Git:** For cloning the repository.
-   **Node.js & npm:** (Version 16.x or newer is recommended).
-   **PM2:** A process manager for Node.js to keep your application running.
    ```bash
    npm install pm2 -g
    ```
-   **Nginx:** A web server and reverse proxy.
    ```bash
    sudo apt update
    sudo apt install nginx
    ```
-   **MySQL Server:** The database for the application.
    ```bash
    sudo apt update
    sudo apt install mysql-server
    sudo mysql_secure_installation
    ```

### 2. Clone the Repository

Clone your project's source code onto the VPS.

```bash
git clone <your-repository-url>
cd <your-project-directory>
```

### 3. Build the Frontend

The React frontend needs to be compiled into static HTML, CSS, and JavaScript files. Before running the build, you must make the Gemini API key available as an environment variable.

```bash
# Install all frontend dependencies
npm install

# Run the build script, providing your API key
# You can get your key from Google AI Studio
API_KEY=AIzaSyCF0j0LFCwPdpz30sdfiyEHG44qlLIGW1Q npm run build
```

This command will create a `dist` directory in your project root, containing the optimized frontend application with the API key embedded.

### 4. Set Up the Backend Application

Navigate to the backend directory and install its dependencies first. This is a crucial step before running any backend scripts.

```bash
# From your project's root directory, navigate to the backend
cd backend

# Install all backend dependencies
npm install
```

### 5. Set Up the Backend Database

Log in to MySQL and create a database and a user for the application.

```bash
sudo mysql
```

Inside the MySQL prompt, execute the following commands. Replace `'your_strong_password'` with a secure password. These commands are safe to run multiple times; they will not cause errors if the database or user already exists.

```sql
CREATE DATABASE IF NOT EXISTS mydb;
CREATE USER IF NOT EXISTS 'ddl_user'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON mydb.* TO 'ddl_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 5.1. Create Database Schema and Seed/Reset Data

Now that the backend dependencies are installed, you can run the script to automatically set up the database tables and initial user accounts.

```bash
# This assumes you are already in the 'backend' directory
# This command will create tables and seed/reset initial data
npm run db:seed
```

This command is **safe to run multiple times**. It performs the following actions:
1.  **Creates Schema:** Creates all required tables (`users`, `clients`, `draws`, `bets`, `transactions`) if they don't already exist.
2.  **Seeds Draws:** Populates the `draws` table with the full schedule for the current day, but only if the table is empty.
3.  **Seeds/Resets Users:** Ensures the default admin and client users exist and **resets their passwords to the default values**. If you are ever locked out or can't log in with the default credentials, run this command again to fix it.

This process ensures the following accounts are available:
-   An **admin** user with username `01` and password `password`.
-   A **client** user with Client ID `02`, username `Sample Client`, and password `password`.

**Security Warning:** You should log in and change these default passwords immediately.

### 6. Configure Environment Variables

Create a `.env` file inside the `backend` directory. This file stores sensitive configuration details that your application needs to run.

```bash
# Still inside the 'backend' directory
nano .env
```

Paste the following content into the file, **replacing the placeholder values with your actual credentials**.

```env
# Backend Server Port
PORT=5000

# JSON Web Token Secret - IMPORTANT: This MUST be a long, random, and secret string.
# DO NOT use an API key or a simple password here.
# You can generate a strong secret with: openssl rand -base64 32
JWT_SECRET=your_super_strong_and_secret_jwt_key_here

# Google Gemini API Key (For AI analysis features)
API_KEY=AIzaSyCF0j0LFCwPdpz30sdfiyEHG44qlLIGW1Q

# --- MySQL Database Connection ---
# Use 127.0.0.1 for the host to avoid potential network issues with 'localhost'.
# Use the database credentials you created in Step 5.

DB_HOST=127.0.0.1
DB_USER=ddl_user
DB_PASSWORD=your_strong_password
DB_DATABASE=mydb
```

Save the file (in `nano`, press `CTRL+X`, then `Y`, then `Enter`).

### 7. Start the Application with PM2

Now, go back to the project's root directory and start the application using PM2. The `ecosystem.config.js` file will automatically provide all necessary environment variables.

```bash
# Go back to the root of your project
cd ..

# Start the application
pm2 start ecosystem.config.js
```

Your application is now running! However, it's only accessible directly via port 5000. The next step is to configure Nginx to make it accessible through your domain.

### 8. Configure Nginx and Secure with SSL

For a production environment on `dubailott.live`, it's essential to run your app behind Nginx as a reverse proxy.

#### A. Basic Nginx Configuration (HTTP)

Create a new Nginx configuration file for your site:
```bash
sudo nano /etc/nginx/sites-available/dubailott.live
```

Paste the following configuration, which forwards requests to your application running on port 5000.

```nginx
# /etc/nginx/sites-available/dubailott.live
server {
    listen 80;
    server_name dubailott.live www.dubailott.live;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site by creating a symbolic link:
```bash
sudo ln -s /etc/nginx/sites-available/dubailott.live /etc/nginx/sites-enabled/
```

Test the Nginx configuration and restart the service:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

At this point, you should be able to access your site at `http://dubailott.live`.

#### B. Adding SSL with Let's Encrypt (HTTPS)

First, install Certbot, the tool for obtaining SSL certificates from Let's Encrypt.
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

Now, run Certbot. It will automatically detect your `dubailott.live` configuration, obtain a certificate, and update your Nginx file to handle HTTPS and redirect HTTP traffic.

```bash
sudo certbot --nginx -d dubailott.live -d www.dubailott.live
```

Follow the on-screen prompts. Certbot will handle the rest. Your site will now be secure and accessible at `https://dubailott.live`.

### 9. Managing the Application

Here are some useful PM2 commands:

-   **List running processes:** `pm2 list`
-   **View real-time logs:** `pm2 logs ddl-backend`
-   **Restart the application:** `pm2 restart ddl-backend`
-   **Stop the application:** `pm2 stop ddl-backend`
-   **Save the process list to restart on server reboot:** `pm2 save`