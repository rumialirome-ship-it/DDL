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

First, create the database itself.

```bash
sudo mysql -e "CREATE DATABASE IF NOT EXISTS mydb;"
```

Now, use the following **single commands** to create the application user and set its password. Replace `'Imranali@Guru1'` if you chose a different password, but ensure it matches what you will use in the next steps.

These commands are safe to run multiple times. They will create the user if it doesn't exist and guarantee the password is set correctly every time.

```bash
# Command to create the user (if it doesn't exist)
sudo mysql -e "CREATE USER IF NOT EXISTS 'ddl_user'@'localhost' IDENTIFIED BY 'Imranali@Guru1';"

# Command to guarantee the password is correct (CRITICAL STEP)
sudo mysql -e "ALTER USER 'ddl_user'@'localhost' IDENTIFIED BY 'Imranali@Guru1';"

# Command to grant permissions
sudo mysql -e "GRANT ALL PRIVILEGES ON mydb.* TO 'ddl_user'@'localhost';"

# Command to apply all changes
sudo mysql -e "FLUSH PRIVILEGES;"
```

### 6. Configure Backend Environment (.env file)

Your backend application needs a way to connect to the database and use other services. This is configured using an environment file. Create a `.env` file inside the `backend` directory.

**This file is the primary source of configuration for the backend.** It is used when you run manual scripts (like `db:seed`) and is also loaded by the main application when it starts. The configuration in `ecosystem.config.js` can serve as an override for production deployments.

```bash
# Make sure you are inside the 'backend' directory
nano .env
```

Paste the following content into the file. The password should match the one you set in the previous step.

```env
# --- Main Backend Configuration ---
# This file is loaded by server.js and is used by manual scripts and the PM2 process.

# Backend Server Port
PORT=5000

# JSON Web Token Secret - IMPORTANT: Use a long, random string.
# Generate with: openssl rand -base64 32
JWT_SECRET=your_super_strong_and_secret_jwt_key_here

# Google Gemini API Key (For AI analysis features)
API_KEY=AIzaSyCF0j0LFCwPdpz30sdfiyEHG44qlLIGW1Q

# --- MySQL Database Connection ---
# Use 127.0.0.1 for the host to avoid potential network issues with 'localhost'.
# Use the database credentials you created in Step 5.

DB_HOST=127.0.0.1
DB_USER=ddl_user
DB_PASSWORD=Imranali@Guru1
DB_DATABASE=mydb
```

Save the file (in `nano`, press `CTRL+X`, then `Y`, then `Enter`).

#### 6.1 Run the Seed Script

Now that the `.env` file exists, you can run the seed script successfully to set up your database tables.

```bash
# This assumes you are already in the 'backend' directory
# This command will create tables and seed/reset initial data
npm run db:seed
```

This command is **safe to run multiple times**. It performs the following actions:
1.  **Creates Schema:** Creates all required tables (`admins`, `clients`, `draws`, `bets`, `transactions`) if they don't already exist.
2.  **Updates/Seeds Draws:** Resets the draw schedule for the current day by removing any `UPCOMING` draws and inserting a fresh schedule.
3.  **Seeds/Resets Users:** Ensures the default admin and client users exist and **resets their passwords to the default values**. If you are ever locked out or can't log in with the default credentials, run this command again to fix it.

**Note:** As of the latest update, the application will **automatically create the schedule for each new day** upon the first request after the daily reset time (11 AM PKT). This seed script is now primarily for initial setup or for manually resetting a day's draw schedule if needed.

This process ensures the following accounts are available:
-   An **admin** user with username `01` and password `password`.
-   A **client** user with Client ID `02`, username `Sample Client`, and password `password`.

**Security Warning:** You should log in and change these default passwords immediately.

### 7. Start the Application with PM2

From the project's root directory, start the application using PM2.

```bash
# Go back to the root of your project
cd ..

# Start the application
pm2 start ecosystem.config.js
```

Your application is now running.

### 8. Configure Nginx and Secure with SSL

This step is unchanged. Configure Nginx to act as a reverse proxy for your application running on port 5000 and secure it with an SSL certificate.

### 9. Managing the Application

Here are some useful PM2 commands:

-   **List running processes:** `pm2 list`
-   **View real-time logs:** `pm2 logs ddl-backend`
-   **Restart the application:** `pm2 restart ddl-backend`
-   **Stop the application:** `pm2 stop ddl-backend`
-   **Save the process list to restart on server reboot:** `pm2 save`

### 10. Troubleshooting

#### Problem: Application fails to start with "Access Denied" for database user

This is the most common deployment issue. It means the application cannot log in to the MySQL database because the credentials it's using are incorrect.

**Root Cause:** There is a mismatch between the credentials in your configuration files and the credentials in the MySQL database itself.

**Solution Checklist:**

1.  **Verify MySQL User and Password:** First, guarantee the password in MySQL is what you think it is. Run this command, replacing the password if needed. This command is safe and will fix any password mismatches.
    ```bash
    sudo mysql -e "ALTER USER 'ddl_user'@'localhost' IDENTIFIED BY 'Imranali@Guru1';"
    ```

2.  **Check `backend/.env`:** This file is the primary source of configuration. Open it and ensure `DB_USER`, `DB_PASSWORD`, and `DB_DATABASE` match the credentials you set up.
    ```bash
    # In your project's root directory
    nano backend/.env
    ```

3.  **Check `ecosystem.config.js`:** This file is used by PM2 and its settings will **override** the `.env` file. Open it and ensure the `env` block has the correct `DB_USER`, `DB_PASSWORD`, and `DB_DATABASE`.
    ```bash
    # In your project's root directory
    nano ecosystem.config.js
    ```

4.  **Restart PM2 Correctly:** After making any changes to `ecosystem.config.js`, you **must** do a full restart for PM2 to apply them. A simple `restart` is often not enough.
    ```bash
    pm2 delete ddl-backend
    pm2 start ecosystem.config.js
    ```

By checking these three places (MySQL, `.env`, `ecosystem.config.js`), you will find and fix the credential mismatch.


#### Problem: Admin login fails with "Invalid credentials"

-   **Cause:** The password stored in the database for the admin user (`01`) is incorrect, or you have forgotten a custom password you set.
-   **Solution:** A dedicated script is provided to safely reset **only** the admin password back to the default (`password`) without affecting any other data.
    1.  Make sure you have correctly configured your `backend/.env` file as described in Step 6.
    2.  From the `backend` directory, run the following command:
        ```bash
        # This will reset the admin password to 'password'
        npm run admin:reset-password
        ```
    3.  After the script confirms success, try logging in again with username `01` and password `password`.