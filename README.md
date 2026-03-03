# Work Activity Tracking System – Architecture & Walkthrough

A practical, professional guide to explaining the technical architecture, security, and data flow of the Work Activity Tracking system to your professors. 

---

## 1. The Core Architecture (MVT)

Django uses the **MVT (Model-View-Template)** architecture. This separates the database, the logic, and the user interface cleanly.

Here is exactly how data flows when a user interacts with the system:
1.  **Request:** A user clicks a link (e.g., "My Activities"). The browser sends a request to the server.
2.  **Routing (`urls.py`):** Django looks at the requested URL path and routes it to the correct Python function.
3.  **Logic (`views.py`):** The View function runs. It checks who the user is, verifies their permissions, and asks the database for the right data.
4.  **Database (`models.py`):** Django's ORM (Object-Relational Mapping) translates Python commands into SQL, fetching the data from the SQLite database.
5.  **Response (`templates/`):** The View passes the data to an HTML Template. The template renders the data into a final HTML webpage and sends it back to the browser.

---

## 2. The Database Layer (`models.py`)

The database consists of three custom tables that interact with Django's built-in `User` table (which handles password hashing and basic authentication securely).

*   **Employee Table:** 
    *   Linked directly to the `User` table.
    *   Stores business-specific metadata: `employee_id`, `department`, `position`.
    *   Crucially, stores the **`role`** (`employee`, `manager`, or `admin`), which drives all access control in the app.
*   **Team Table:** 
    *   Groups Employees together for management purposes.
    *   Has a `manager` (a single Employee) and `members` (a Many-To-Many relationship with Employees).
*   **WorkActivity Table:** 
    *   The core transactional data.
    *   Linked to an `Employee` via a Foreign Key relation (One-to-Many: One employee can have many activities).
    *   Tracks `title`, `description`, `status` (In Progress, Completed, Paused), `start_time`, and `end_time`.
    *   Contains a smart helper method `duration_hours()` that automatically calculates the time spent on a task.

---

## 3. The Security Layer (`decorators.py`)

Security is handled via **Role-Based Access Control (RBAC)**. 

To keep the code clean and strictly enforce security across the whole application, we built custom Python *Decorators*. A decorator is a security checkpoint placed directly above a view function.

*   **`@employee_required`**: Simply checks if the user is logged in and has a valid Employee profile in the database.
*   **`@manager_required`**: Checks if the logged-in user explicitly holds the `manager` or `admin` role. If an ordinary employee tries to access a URL protected by this, they are blocked and redirected to their own dashboard.
*   **`@admin_required`**: Strictly restricts access to the `admin` role.

> **💡 Professor Talking Point:**  
> *"Instead of hardcoding 'if user.role == manager' inside every single view function, I abstracted the security logic into decorators. This makes the codebase DRY (Don't Repeat Yourself), eliminates the risk of forgetting a security check, and makes the application highly scalable."*

---

## 4. Business Logic (`views.py`)

The views are strictly separated based on the three roles in the system, ensuring data isolation.

### The Smart Router
*   **`dashboard`**: When any user logs in, they are sent to the root `/work/` URL. This view acts as a traffic cop. It reads their `role` and instantly redirects them to `/work/my/` (Employee), `/work/manager/` (Manager), or `/work/admin/`.

### Employee Views (Protected by `@employee_required`)
*   **`employee_dashboard`**: Fetches and aggregates *only* the `WorkActivity` records where `employee = request.user.employee_profile`. 
*   **`activity_update` & `activity_delete`**: 
    > **💡 Professor Talking Point:**  
    > *"When an employee tries to edit or delete a task, the system doesn't just look up the task ID. It looks up `Task ID + Owning Employee`. This prevents Insecure Direct Object Reference (IDOR) attacks, ensuring a user cannot alter someone else's task simply by manipulating the URL ID."*

### Manager Views (Protected by `@manager_required`)
*   **`manager_dashboard`**: Queries the `Team` table exclusively for teams where `manager = request.user`. It then aggregates team-wide statistics (how many tasks are completed vs. in-progress across all members).
*   **`team_detail`**: Allows the manager to drill down into a specific team and view all underlying activities, filtering dynamically by specific members or task statuses.

### Admin Views (Protected by `@admin_required`)
*   **`admin_dashboard` & `admin_employees`**: Grants global access to all records across all teams. Includes functionality to dynamically promote or demote users by changing their roles on the fly directly from the UI.

---

## 5. The User Interface (`templates/`)

The frontend utilizes **Django Template Inheritance** to build the UI efficiently without duplicated code.

*   **`base.html` (The Master Layout):** 
    *   Contains the CSS framework (a modern, dark-mode Glassmorphism design).
    *   Contains the Sidebar navigation. 
    *   The sidebar uses logic (`{% if emp.role == 'manager' %}`) to dynamically render menu items. An ordinary employee literally cannot see the "Team Analytics" button in their navigation.
*   **Child Templates (e.g., `employee_dashboard.html`):** 
    *   These files start with `{% extends "work/base.html" %}`. They inherit the entire shell of the website (navbar, sidebar, styling) and only inject the specific tables, forms, and statistics needed for that specific page.

---

## 🌟 Summary Q&A for Presentation

**Q: How do you prevent employees from seeing or editing other people's tasks?**  
**A:** At the database query level, every fetch, edit, or delete operation explicitly checks `employee=request.user.employee_profile`. It's hardcoded into the view queries, making data leakage impossible.

**Q: How does authentication and permissions work?**  
**A:** We use Django's built-in robust session authentication for logging in/out, paired with custom Role-Based Access Control (RBAC) decorators on our views to govern authorization based on the user's `role` field.

**Q: What design pattern did you use?**  
**A:** Django’s MVT (Model-View-Template) pattern, ensuring strict separation of concerns between database shape, business logic, and UI presentation.
