document.addEventListener("DOMContentLoaded", function() {
    var form = document.querySelector("form");
    
    if (!form) return;

    form.addEventListener("submit", function(event) {
        var p1 = document.getElementById("newPassword").value;
        var p2 = document.getElementById("confirmPassword").value;

        if (p1 !== p2) {
            event.preventDefault();
            alert("Passwords do not match!");
        }
    });
});