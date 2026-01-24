document.addEventListener("DOMContentLoaded", function () {
    const welcomeText = document.getElementById("welcomeText");
    if (!welcomeText) return;

    const role = window.userRole || "User";
    const name = window.loggedInUser || "Guest";

    if (role === "Admin") {
        welcomeText.innerText = `Welcome, Admin `;
    } else {
        welcomeText.innerText = `Welcome, Librarian ${name}`;
    }
});
