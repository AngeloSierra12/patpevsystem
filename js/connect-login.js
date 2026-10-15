async function setupLoginPage() {
    var form = document.getElementById('login');
    var button = document.getElementById('btn');
    form.removeAttribute('action');

    var errorLine = document.createElement('p');
    errorLine.style.color = '#c0392b';
    errorLine.style.margin = '0 0 12px';
    errorLine.hidden = true;
    form.insertBefore(errorLine, button);

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        errorLine.hidden = true;
        button.disabled = true;
        button.textContent = 'Logging in...';

        try {
            await api('login.php', 'POST', {
                username: document.getElementById('Uname').value.trim(),
                password: document.getElementById('Pass').value,
                remember: document.getElementById('check').checked
            });
            window.location.href = 'dashboard.html';
        } catch (error) {
            showFormError(errorLine, error.message);
            button.disabled = false;
            button.textContent = 'Log in';
        }
    });

    try {
        var check = await fetch(API + 'me.php');
        if (check.ok) {
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
    }
}

setupLoginPage();
