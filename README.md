# How MVT Works in the Work Activity Tracking System

Django follows the **MVT (Model-View-Template)** architecture. This guide explains exactly how this pattern is implemented in your Work Activity Tracking project.

---

## The Big Picture: How Data Flows
When a user interacts with your application (e.g., an employee clicking "Log Activity"), here is the strict order of events:

1. **User Request:** The browser requests a URL (e.g., `/work/activities/log/`).
2. **URL Routing (`urls.py`):** Django intercepts the URL and asks, *"Which View handles this?"*
3. **View (`views.py`):** The View function takes over. It acts as the middleman.
4. **Model (`models.py`):** If the View needs to save or fetch data, it talks to the Model (the database).
5. **Template (`templates/`):** Once the View has the data, it passes it to a Template. The template generates the final HTML webpage.
6. **Response:** The HTML is sent back to the user's browser.

Let's break down each of the three pillars (M, V, T) specifically for your project.

---

## 1. M is for Model (`models.py`)
The **Model** is responsible for the database. It defines the structure of your data and handles all interactions with the SQLite database via Django's ORM (Object-Relational Mapping). *You never have to write raw SQL.*

### In Your Project:
Your `models.py` defines three core tables:
*   **`Employee`**: Connects to Django's built-in `User` system. It adds the critical `role` field (`employee`, `manager`, `admin`) which controls exactly what a user is allowed to do.
*   **`Team`**: Establishes relationships. It has a `manager` and a list of `members`.
*   **`WorkActivity`**: The main transactional table. It logs the `title`, `description`, `status` (In Progress/Completed), and calculates the duration of tasks.

**How the View uses the Model:**
When an employee updates a task, the View does this:
```python
# The View asks the Model to fetch a specific record from the database
activity = get_object_or_404(WorkActivity, pk=pk, employee=emp)

# The View modifies the data and asks the Model to save it back to the database
activity.status = 'completed'
activity.save()
```

---

## 2. V is for View (`views.py`)
The **View** is the brain of the application. It contains the **business logic**. It receives the user's HTTP request, fetches necessary data from the Models, applies logic/security, and decides which Template to render.

### In Your Project:
Your `views.py` is strictly organized by role to ensure security and clean logic.

*   **Security Logic:** Your views use custom decorators (`@employee_required`, `@manager_required`) to stop unauthorized users before the view even runs.
*   **Data Fetching:** When a manager visits the `manager_dashboard` view, the view queries the Model:
    ```python
    teams = Team.objects.filter(manager=emp) # "Give me all teams managed by this person"
    ```
*   **Context Packaging:** The view gathers all this data, packages it into a dictionary called `context`, and hands it to the Template:
    ```python
    context = {'teams': teams, 'emp': emp}
    return render(request, 'work/manager_dashboard.html', context)
    ```

---

## 3. T is for Template (`templates/`)
The **Template** is the presentation layer. It takes the raw data (`context`) provided by the View and injects it into HTML so the user sees a nicely formatted webpage.

### In Your Project:
You used **Template Inheritance** to make your UI efficiently.

*   **`base.html` (The Parent):** This template contains the standard HTML shell (the `<head>`, CSS styles, and the Sidebar navigation).
    *   *MVT Magic:* The template can read database properties directly! The sidebar checks `{% if emp.role == 'manager' %}` to decide whether to hide or show the "Team Analytics" button for that specific user.
*   **`employee_dashboard.html` (The Child):** This template only contains the specific layout for the dashboard. It uses Django tags like `{% extends "work/base.html" %}` to inherit the sidebar from the parent.
    *   *MVT Magic:* It loops through the data provided by the View to render the table rows:
      ```html
      {% for act in activities %}
          <tr><td>{{ act.title }}</td> <td>{{ act.status }}</td></tr>
      {% endfor %}
      ```

---

## Summary: A Real-World Example in Your App

Let's trace **"An employee logging a new activity"** through the MVT pattern:

1. **User Action:** Employee fills out the "Log Activity" HTML form and clicks submit.
2. **URL:** The form submits a POST request to `/work/activities/log/`.
3. **View (`activity_create`):** 
   - Protects the route via `@employee_required`.
   - Extracts the form data (`title`, `description`, `status`).
4. **Model (`WorkActivity.objects.create(...)`):**
   - The View tells the Model to create a brand new row in the database table and link it to the employee.
5. **Response (Redirect):**
   - The View tells the browser to redirect back to the `/work/my/` URL layout.
6. **New View/Template Cycle:**
   - The `employee_dashboard` View runs, asks the Model for all activities (now including the new one), and passes them to the `employee_dashboard.html` Template to render on the screen.
