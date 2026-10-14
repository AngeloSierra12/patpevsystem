(async function () {
    try {
        await startPage();
    } catch (err) {
        return;
    }

    var popup = document.getElementById('edit-details');
    var form = popup.querySelector('form');
    form.removeAttribute('action');
    var saveBtn = form.querySelector('button[type=submit]');
    var error = document.createElement('p');
    error.style.color = '#c0392b';
    error.hidden = true;
    form.insertBefore(error, form.querySelector('.actions'));

    var passwordBtn = Array.prototype.find.call(document.querySelectorAll('.actions a.button'), function (a) {
        return a.textContent.trim() === 'Change password';
    });

    function field(id) {
        return document.getElementById(id);
    }

    async function load() {
        try {
            var data = await api('account.php');
        } catch (err) {
            showError(document.getElementById('details'), err);
            return;
        }
        var u = data.user;

        document.getElementById('photo').textContent = (u.firstName.charAt(0) + u.lastName.charAt(0)).toUpperCase();
        document.getElementById('name').textContent = u.fullName;
        document.querySelector('#person p.small').textContent = u.email;

        document.getElementById('details').innerHTML = [
            ['Username', u.username],
            ['Role', u.roleName],
            ['Department', u.department || '-'],
            ['Contact', u.phone || '-'],
            ['Account created', dateTime(u.createdAt)],
            ['Last sign-in', dateTime(u.lastLoginAt)],
        ].map(function (r) {
            return '<tr><td class="label">' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>';
        }).join('');

        document.getElementById('perms').innerHTML = Object.keys(data.permissions).map(function (k) {
            return '<tr><td>' + esc(k) + '</td><td class="num">' + esc(data.permissions[k]) + '</td></tr>';
        }).join('');

        document.getElementById('activity').innerHTML = data.recentActivity.length ? data.recentActivity.map(function (a) {
            return '<tr><td>' + esc(a.description) + (a.failed ? ' <span class="tag red">Failed</span>' : '') +
                '</td><td class="num small">' + dateTime(a.time) + '</td></tr>';
        }).join('') : '<tr><td>No activity yet.</td></tr>';

        var seeAll = document.querySelector('a.more[href="audit-trail.html"]');
        if (seeAll && u.role !== 'ADMIN') seeAll.style.display = 'none';

        field('first').value = u.firstName;
        field('last').value = u.lastName;
        field('contact').value = u.phone || '';
        field('email').value = u.email;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        error.hidden = true;
        saveBtn.disabled = true;
        try {
            await api('account.php', 'PUT', {
                firstName: field('first').value.trim(),
                lastName: field('last').value.trim(),
                phone: field('contact').value.trim(),
                email: field('email').value.trim(),
            });
            window.location.hash = '';
            var fresh = (await api('me.php')).user;
            document.querySelector('.dropbtn').innerHTML = 'Hi, ' + esc(fresh.fullName.split(' ')[0]) + ' &#9662;';
            document.getElementById('who').innerHTML = esc(fresh.fullName) + '<br><span>' + esc(fresh.roleName) + '</span>';
            load();
        } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
        }
        saveBtn.disabled = false;
    });

    if (passwordBtn) {
        passwordBtn.classList.remove('off');
        passwordBtn.href = '#';
        passwordBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            var current = prompt('Current password:');
            if (current === null) return;
            var next = prompt('New password (at least 8 characters):');
            if (next === null) return;
            var again = prompt('Type the new password again:');
            if (again === null) return;
            if (next !== again) return alert('The new passwords do not match.');
            try {
                await api('account.php', 'POST', { currentPassword: current, newPassword: next });
                alert('Password changed.');
                load();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    load();
})();
