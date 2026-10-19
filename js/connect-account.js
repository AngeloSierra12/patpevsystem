var detailsForm;
var detailsError;
var passwordForm;
var passwordError;

function field(id) {
    return document.getElementById(id);
}

function detailRow(label, value) {
    return '<tr><td class="label">' + label + '</td><td>' + esc(value) + '</td></tr>';
}

async function loadAccount() {
    var data;
    try {
        data = await api('account.php');
    } catch (error) {
        showError(field('details'), error);
        return;
    }
    var user = data.user;

    field('photo').textContent = (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
    field('name').textContent = user.fullName;
    document.querySelector('#person p.small').textContent = user.email;

    field('details').innerHTML =
        detailRow('Username', user.username) +
        detailRow('Role', user.roleName) +
        detailRow('Department', user.department || '-') +
        detailRow('Contact', user.phone || '-') +
        detailRow('Account created', dateTime(user.createdAt)) +
        detailRow('Last sign-in', dateTime(user.lastLoginAt));

    var permissions = '';
    for (var name in data.permissions) {
        permissions += '<tr><td>' + esc(name) + '</td><td class="num">' + esc(data.permissions[name]) + '</td></tr>';
    }
    field('perms').innerHTML = permissions;

    var activity = '';
    for (var i = 0; i < data.recentActivity.length; i++) {
        var item = data.recentActivity[i];
        var failed = '';
        if (item.failed) {
            failed = ' <span class="tag red">Failed</span>';
        }
        activity += '<tr><td>' + esc(item.description) + failed + '</td><td class="num small">' + dateTime(item.time) + '</td></tr>';
    }
    if (activity === '') {
        activity = '<tr><td>No activity yet.</td></tr>';
    }
    field('activity').innerHTML = activity;

    var seeAll = document.querySelector('a.more[href="audit-trail.html"]');
    if (seeAll && user.role !== 'ADMIN') {
        seeAll.style.display = 'none';
    }

    field('first').value = user.firstName;
    field('last').value = user.lastName;
    field('contact').value = (user.phone || '').replace(/^\+63\s*/, '');
    field('email').value = user.email;
}

async function saveDetails(event) {
    event.preventDefault();
    detailsError.hidden = true;

    var saveButton = detailsForm.querySelector('button[type=submit]');
    saveButton.disabled = true;
    try {
        await api('account.php', 'PUT', {
            firstName: field('first').value.trim(),
            lastName: field('last').value.trim(),
            phone: field('contact').value.trim(),
            email: field('email').value.trim()
        });
        closePopup();

        var me = await api('me.php');
        document.querySelector('.dropbtn').innerHTML = 'Hi, ' + esc(me.user.fullName.split(' ')[0]) + ' &#9662;';
        field('who').innerHTML = esc(me.user.fullName) + '<br><span>' + esc(me.user.roleName) + '</span>';
        loadAccount();
    } catch (error) {
        showFormError(detailsError, error.message);
    }
    saveButton.disabled = false;
}

async function changePassword(event) {
    event.preventDefault();
    passwordError.hidden = true;

    if (field('new-pass').value !== field('again').value) {
        showFormError(passwordError, 'The new passwords do not match.');
        return;
    }

    try {
        await api('account.php', 'POST', {
            currentPassword: field('current').value,
            newPassword: field('new-pass').value
        });
        passwordForm.reset();
        closePopup();
        alert('Password changed.');
        loadAccount();
    } catch (error) {
        showFormError(passwordError, error.message);
    }
}

async function setupAccountPage() {
    try {
        await startPage();
    } catch (error) {
        return;
    }

    detailsForm = document.querySelector('#edit-details form');
    detailsForm.removeAttribute('action');
    detailsError = addErrorLine(detailsForm);
    detailsForm.addEventListener('submit', saveDetails);

    passwordForm = document.querySelector('#change-password form');
    passwordForm.removeAttribute('action');
    passwordError = addErrorLine(passwordForm);
    passwordForm.addEventListener('submit', changePassword);

    loadAccount();
}

setupAccountPage();
