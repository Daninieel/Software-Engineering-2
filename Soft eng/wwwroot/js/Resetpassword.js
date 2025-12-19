<script>
    document.addEventListener("DOMContentLoaded", function() {
         var form = document.getElementById("registerForm");

    form.addEventListener("submit", function(event) {
             var p1 = document.getElementById("newPassword").value;
    var p2 = document.getElementById("confirmPassword").value;

    if (p1 !== p2) {
        event.preventDefault(); // Stop form submission
    alert("Passwords do not match!");
             }
         });
     });
</script>