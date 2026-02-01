document.addEventListener("DOMContentLoaded", function () {
    const welcomeText = document.getElementById("welcomeText");
    if (!welcomeText) return;

    const role = window.userRole || "User";
    let name = window.loggedInUser || "Guest";
    
    name = name.trim();
    
    if (name && name !== "Guest" && name.toLowerCase() !== "guest") {
        if (name.includes("@")) {
            const parts = name.split("@")[0];
            name = parts.charAt(0).toUpperCase() + parts.slice(1);
        } else {
            name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        }
    } else {
        name = "User";
    }

    if (role === "Admin") {
        welcomeText.innerText = `Welcome, Admin`;
    } else {
        welcomeText.innerText = `Welcome, Librarian ${name}`;
    }
});
