document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userMenuToggle = document.getElementById("user-menu-toggle");
  const userMenu = document.getElementById("user-menu");
  const openLoginModalBtn = document.getElementById("open-login-modal");
  const teacherLogoutBtn = document.getElementById("teacher-logout");
  const teacherStatus = document.getElementById("teacher-status");
  const loginModal = document.getElementById("login-modal");
  const closeLoginModalBtn = document.getElementById("close-login-modal");
  const teacherLoginForm = document.getElementById("teacher-login-form");
  const teacherUsernameInput = document.getElementById("teacher-username");
  const teacherPasswordInput = document.getElementById("teacher-password");
  const emailInput = document.getElementById("email");
  const signupButton = signupForm.querySelector("button[type='submit']");

  let teacherToken = localStorage.getItem("teacherToken");
  let teacherUsername = localStorage.getItem("teacherUsername");

  function authHeaders() {
    if (!teacherToken) {
      return {};
    }

    return { "X-Teacher-Token": teacherToken };
  }

  function setAuthUi(isAuthenticated) {
    if (isAuthenticated) {
      teacherStatus.textContent = `Teacher mode: logged in as ${teacherUsername}`;
      teacherStatus.className = "success";
      openLoginModalBtn.classList.add("hidden");
      teacherLogoutBtn.classList.remove("hidden");
      emailInput.disabled = false;
      activitySelect.disabled = false;
      signupButton.disabled = false;
      signupButton.title = "";
    } else {
      teacherStatus.textContent = "Teacher mode: logged out";
      teacherStatus.className = "info";
      openLoginModalBtn.classList.remove("hidden");
      teacherLogoutBtn.classList.add("hidden");
      emailInput.disabled = true;
      activitySelect.disabled = true;
      signupButton.disabled = true;
      signupButton.title = "Only logged-in teachers can register students";
    }
  }

  function clearTeacherSession() {
    teacherToken = null;
    teacherUsername = null;
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
  }

  async function refreshTeacherStatus() {
    try {
      const response = await fetch("/auth/teacher/status", {
        headers: authHeaders(),
      });
      const result = await response.json();

      if (result.authenticated) {
        teacherUsername = result.username;
        localStorage.setItem("teacherUsername", teacherUsername);
        setAuthUi(true);
      } else {
        clearTeacherSession();
        setAuthUi(false);
      }
    } catch (error) {
      clearTeacherSession();
      setAuthUi(false);
      console.error("Error checking teacher status:", error);
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        const isTeacherAuthenticated = Boolean(teacherToken);

        // Create participants HTML with delete icons for logged-in teachers
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacherAuthenticated
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!teacherToken) {
      messageDiv.textContent = "Only logged-in teachers can unregister students.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearTeacherSession();
          setAuthUi(false);
        }
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!teacherToken) {
      messageDiv.textContent = "Only logged-in teachers can register students.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearTeacherSession();
          setAuthUi(false);
        }
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  userMenuToggle.addEventListener("click", () => {
    userMenu.classList.toggle("hidden");
  });

  openLoginModalBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    userMenu.classList.add("hidden");
  });

  closeLoginModalBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    teacherLoginForm.reset();
  });

  teacherLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const response = await fetch("/auth/teacher/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: teacherUsernameInput.value,
          password: teacherPasswordInput.value,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        messageDiv.textContent = result.detail || "Login failed";
        messageDiv.className = "error";
        messageDiv.classList.remove("hidden");
        return;
      }

      teacherToken = result.token;
      teacherUsername = result.username;
      localStorage.setItem("teacherToken", teacherToken);
      localStorage.setItem("teacherUsername", teacherUsername);

      setAuthUi(true);
      loginModal.classList.add("hidden");
      teacherLoginForm.reset();
      fetchActivities();

      messageDiv.textContent = `Logged in as ${teacherUsername}`;
      messageDiv.className = "success";
      messageDiv.classList.remove("hidden");
    } catch (error) {
      messageDiv.textContent = "Login failed. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  teacherLogoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/teacher/logout", {
        method: "POST",
        headers: authHeaders(),
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    clearTeacherSession();
    setAuthUi(false);
    userMenu.classList.add("hidden");
    fetchActivities();

    messageDiv.textContent = "Logged out";
    messageDiv.className = "success";
    messageDiv.classList.remove("hidden");
  });

  // Initialize app
  refreshTeacherStatus();
  fetchActivities();
});
