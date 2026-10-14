(function () {
    var form = document.getElementById('login');
    var btn = document.getElementById('btn');
    form.removeAttribute('action');

    var error = document.createElement('p');
    error.style.color = '#c0392b';
    error.style.margin = '0 0 12px';
    error.hidden = true;
    form.insertBefore(error, btn);

    fetch(API + 'me.php').then(function (res) {
        if (res.ok) window.location.href = 'dashboard.html';
    }).catch(function () { });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        error.hidden = true;
        btn.disabled = true;
        btn.textContent = 'Logging in...';
        try {
            await api('login.php', 'POST', {
                username: document.getElementById('Uname').value.trim(),
                password: document.getElementById('Pass').value,
                remember: document.getElementById('check').checked,
            });
            window.location.href = 'dashboard.html';
        } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
            btn.disabled = false;
            btn.textContent = 'Log in';
        }
    });
})();
