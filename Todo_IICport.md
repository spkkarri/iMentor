### **Project Blueprint: Locally Deployed NIRF Portal with Faculty Authentication**

**Objective:** To build a self-contained web portal, running on a local server, for your institute's faculty to log in and submit their individual data for the NIRF Innovation Rankings. The system will then collate the data, calculate scores, and provide departmental and institutional overviews for the NIRF coordinator.

**Core Philosophy:** "An appliance-like" model. The entire application stack (frontend, backend, database) will be containerized. This means the institute's IT team only needs to install Docker and run a simple command to start the entire portal.

---

### **Phase 1: Architecture and Design (Week 1)**

This phase is about creating a solid plan before writing any code.

#### **1.1. Technology Stack (Optimized for Local Deployment)**

*   **Containerization:** **Docker & Docker Compose**. This is the most critical part of the plan. It bundles every part of the application into portable containers, making local setup trivial.
*   **Frontend:** **React** or **Vue.js**. These compile to static files that are easy to serve.
*   **Backend Microservices:** **Python with FastAPI**. It's extremely fast, has automatic API documentation (crucial for student developers), and is perfect for building secure, data-focused APIs.
*   **Database:** **PostgreSQL**. A robust, open-source database that runs perfectly in a Docker container.
*   **Web Server / Reverse Proxy:** **Nginx**. It will serve the frontend application and act as a secure gateway, directing traffic to the correct backend microservice.
*   **Version Control:** **Git** (using a local GitLab instance or a private GitHub repository).

#### **1.2. Local Architecture**

The system will run in a collection of connected Docker containers on a single local server:

1.  **User's Browser:** A faculty member accesses the portal via a local URL (e.g., `http://nirf-portal.local` or `http://192.168.1.100`).
2.  **Nginx Container:** Receives all requests.
    *   If it's a request for the main page, it serves the React/Vue frontend.
    *   If it's an API request (e.g., `/api/...`), it forwards it to the appropriate backend microservice.
3.  **Backend Microservice Containers:**
    *   **Auth Service:** Handles `POST /api/auth/login`, `GET /api/auth/me`. Manages usernames, hashed passwords, and issues JWT (JSON Web Tokens) to authenticated users.
    *   **Data Service:** Handles all NIRF data operations like `GET /api/data/ia` (Innovation Achievements) or `POST /api/data/rio` (Research & Innovation Output). It will always check for a valid JWT to ensure the user is logged in.
    *   **Scoring Service:** Provides endpoints like `GET /api/scores/faculty/{id}` or `GET /api/scores/department/{id}`.
4.  **PostgreSQL Container:** The central database where all user credentials and NIRF data are securely stored.
5.  **(Optional) Redis Container:** Can be used for caching scores to improve dashboard loading times.

#### **1.3. Database and API Design**

*   **Database Schema:**
    *   `users` table: `id`, `username` (e.g., employee ID), `password` (hashed using a strong algorithm like bcrypt), `full_name`, `email`, `department_id`, `role` ('faculty', 'hod', 'admin').
    *   `departments` table: `id`, `name`.
    *   Data Tables: Create a separate table for each of the 6 main NIRF parameters (e.g., `financial_support_fsi`, `innovation_achievements_ia`). Each row must be linked to a `faculty_id` to show who submitted it.
*   **API Design (using OpenAPI Specification):**
    *   Define all endpoints. Every endpoint under `/api/data/` and `/api/scores/` MUST be protected and require an authentication token.
    *   The frontend will send the token in the `Authorization` header of every API request after the user logs in. The backend will validate this token before processing the request.

---

### **Phase 2: Core Development (Weeks 2 & 3)**

The team should split into frontend and backend developers and work in parallel.

#### **2.1. Backend Development Tasks**

1.  **Setup Docker Compose:** Create the `docker-compose.yml` file that defines all the services (nginx, backend, postgres). This is the master file for the entire project.
2.  **Develop the Authentication Service (Priority 1):**
    *   Create the `users` and `departments` models.
    *   Implement user registration (can be an admin-only feature or a signup page).
    *   Implement the `/api/auth/login` endpoint. It should take a username and password, check them against the database, and return a JWT if successful.
    *   Create a security dependency that other endpoints can use to verify the JWT and identify the logged-in user.
3.  **Develop the NIRF Data Services:**
    *   Create the data models and API endpoints for each NIRF parameter. For example, for "Financial Support for Innovation (FSI)", create endpoints to `CREATE`, `READ`, `UPDATE`, and `DELETE` FSI entries for the logged-in faculty member.
4.  **Develop the Scoring Engine:**
    *   Implement the scoring logic from the NIRF document. Create functions that take faculty or department data and return a calculated score.
5.  **Develop External Integrations (Google Scholar/ORCID):**
    *   Build the service that takes a faculty member's ID and fetches data. **Note:** Google Scholar does not have an official API, so you will need to use a third-party library (like `scholarly`) which performs web scraping. This can be fragile and might break if Google changes its layout. The ORCID integration is more stable as it has an official API.

#### **2.2. Frontend Development Tasks**

1.  **Setup Frontend Project:** Initialize React/Vue project.
2.  **Create the Login Page:** A simple form with username and password fields. On successful login, store the received JWT securely in the browser (e.g., in `localStorage` or a cookie).
3.  **Create a "Layout" for Authenticated Users:** This will include a navigation bar (with a logout button) and a main content area. The application should redirect to the login page if a user tries to access this layout without being authenticated.
4.  **Build the Faculty Dashboard:**
    *   This is the main page after login.
    *   Create data entry forms for each of the 6 NIRF parameters. The forms should be intuitive and match the fields in the document.
    *   Display a table of already submitted data, with options to edit or delete.
    *   Show the faculty member's individual calculated score.
5.  **Build HOD/Admin Dashboards:**
    *   Create separate views (visible only to users with the 'hod' or 'admin' role) that show aggregated data and scores for their department or the entire institute.

---

### **Phase 3: Testing, Deployment, and Handoff (Week 4)**

This phase is about making the portal stable and easy to use.

#### **3.1. Automated Testing**

*   **Backend:** Use `pytest` to write unit tests for the scoring logic and integration tests for the API endpoints (e.g., test that a protected endpoint correctly rejects a request with no token).
*   **Frontend:** Use a tool like **Cypress** to write end-to-end tests that simulate a user's entire journey:
    1.  Visit the login page.
    2.  Fail to log in with bad credentials.
    3.  Successfully log in.
    4.  Navigate to a data entry form.
    5.  Fill out and submit the form.
    6.  Verify the data appears in the dashboard.
    7.  Log out.

#### **3.2. Local Deployment and Handoff Instructions**

Create a `README.md` file with clear instructions for the institute's IT administrator.

**Prerequisites on the Server:**
*   A machine running a modern OS (e.g., Ubuntu Server 22.04, Windows Server).
*   Docker and Docker Compose installed.
*   Git installed.

**One-Time Setup Steps:**
1.  Clone the project repository: `git clone <your-repo-url>`.
2.  Navigate into the project directory: `cd nirf-portal`.
3.  Create the environment configuration file: `cp .env.example .env`.
4.  Edit the `.env` file to set a secure database password.
5.  Build and start all services in the background: `docker-compose up --build -d`.

**Portal is now running!** It can be accessed at `http://<server-ip-address>`.

**Initial Admin User Setup:**
You must provide a way to create the first administrator. A simple way is to add a custom command to your backend service.
1.  Create a script that allows creating a user from the command line.
2.  The IT admin can run this with Docker: `docker-compose exec backend python create_admin_user.py --username admin --password <secure_password> --role admin`.
3.  The admin can then log in to the portal and create accounts for HODs and faculty through the UI.
