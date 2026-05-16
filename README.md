# Team Task Manager (TaskFlow)

TaskFlow is a web application for managing team projects and tasks. It includes features for user authentication, role-based access, and task tracking through a dashboard and Kanban board.

## Tech Stack
- Frontend: HTML, CSS, JavaScript (Single Page Application)
- Backend: FastAPI (Python)
- Database: SQLite for local dev, PostgreSQL for production
- Deployment: Docker and Railway

## Features
- Email verification using OTP during registration.
- JWT-based authentication for secure API access.
- Two user roles: Admin (full access) and Member (project-specific access).
- Project management (create projects, invite members).
- Task management (set priority, status, and assign multiple team members).
- Dashboard with project stats and a Kanban board.

## Local Setup

### Prerequisites
- Python 3.11 or higher
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd team-task-manager
   ```

2. Set up a virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```

3. Install the required packages:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. Configure environment variables:
   Copy the example env file and fill in your details (especially SMTP settings for emails).
   ```bash
   cp backend/.env.example backend/.env
   ```

### Running the App
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Start the server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
- Application: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/api/health

## Deployment to Railway

This project is configured for deployment on Railway using Docker.

1. Push your code to a GitHub repository.
2. In Railway, create a new project and connect it to your GitHub repo.
3. Add a PostgreSQL database to your Railway project.
4. Set the following environment variables in the Railway dashboard:
   - `DATABASE_URL` (Automatically added by Railway)
   - `SECRET_KEY` (Any long random string)
   - `ALGORITHM` (Use HS256)
   - `ACCESS_TOKEN_EXPIRE_MINUTES` (e.g., 1440)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (For email verification)

Railway will use the included Dockerfile and railway.toml to build and deploy the application automatically.

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register a new user (sends OTP) |
| POST | /api/auth/login | Login and get JWT token |
| GET | /api/projects | Get list of projects you belong to |
| POST | /api/projects/{id}/tasks | Add a new task to a project |
| GET | /api/users/dashboard/stats | Get summary stats for the dashboard |
