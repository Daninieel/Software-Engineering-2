document.addEventListener('DOMContentLoaded', () => {

    const addBookForm = document.getElementById('addBookForm');
    const fileInput = document.getElementById('fileUpload');

    addBookForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(addBookForm);
        const data = Object.fromEntries(formData.entries());

        console.log('Book Data Submitted:', data);

        alert('Book successfully added!');

        addBookForm.reset();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            alert(`Image selected: ${fileName}`);
        }
    });

    const logoutBtn = document.querySelector('.logout-text');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to log out?')) {
                window.location.href = "/Home/Login";
            }
        });
    }
});