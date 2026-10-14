(async function () {
    var user;
    try {
        user = await startPage();
    } catch (err) {
        return;
    }
    if (user.role !== 'ADMIN') {
        adminOnly();
        return;
    }

    var filter = document.getElementById('filter');
    filter.removeAttribute('action');
    var table = document.querySelector('main > .box table');
    var count = document.querySelector('main > .box p.small');
    var popup = document.getElementById('add-user');
    var popupForm = popup.querySelector('form');
    popupForm.removeAttribute('action');
    var popupTitle = popup.querySelector('h2');
    var saveBtn = popupForm.querySelector('button[type=submit]');
    var passwordLabel = popupForm.querySelector('label[for=password]');
    var users = [];
    var editingId = null;

    var error = document.createElement('p');
    error.style.color = '#c0392b';
    error.hidden = true;
    popupForm.insertBefore(error, popupForm.querySelector('.actions'));

    function field(id) {
        return document.getElementById(id);
    }

    async function load() {
        var sort = { 'Sort by name': 'name', 'Sort by role': 'role', 'Sort by status': 'status' }[field('sort').value] || 'name';
        try {
            var data = await api('users.php?' + new URLSearchParams({ search: field('search').value.trim(), sort: sort }));
        } catch (err) {
            showError(count, err);
            return;
        }
        users = data.users;
        count.textContent = 'Showing ' + users.length + ' of ' + data.total;
        table.innerHTML = '<tr><th>Full Name</th><th>Contact No.</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr>' +
            users.map(function (u) {
                var self = u.id === user.id;
                return '<tr><td>' + esc(u.fullName) + '</td><td>' + esc(u.phone || '-') + '</td><td>' + esc(u.email) + '</td>' +
                    '<td>' + esc(u.roleName) + '</td><td>' + esc(u.department || '-') + '</td>' +
                    '<td>' + (u.isActive ? 'Active' : '<span class="tag grey">Inactive</span>') + '</td>' +
                    '<td><a href="#" data-edit="' + u.id + '">Edit</a>' +
                    (self ? '' : ' - <a href="#" data-toggle="' + u.id + '">' + (u.isActive ? 'Deactivate' : 'Activate') + '</a>') +
                    '</td></tr>';
            }).join('');
    }

    function openPopup(u) {
        editingId = u ? u.id : null;
        error.hidden = true;
        popupForm.reset();
        popupTitle.textContent = u ? 'Edit User' : 'Add User';
        saveBtn.textContent = u ? 'Save Changes' : 'Save User';
        field('username').readOnly = !!u;
        field('password').required = !u;
        passwordLabel.innerHTML = u ? '<b>New Password (leave blank to keep)</b>' : '<b>Default Password</b>';
        if (u) {
            var parts = u.fullName.split(' ');
            field('last').value = parts.pop();
            field('first').value = parts.join(' ');
            field('contact').value = u.phone || '';
            field('email').value = u.email;
            field('username').value = u.username;
            field('role-admin').checked = u.role === 'ADMIN';
            field('role-staff').checked = u.role !== 'ADMIN';
            field('dept-hostel').checked = u.role === 'STAFF_HOSTEL';
            field('dept-canteen').checked = u.role === 'STAFF_CANTEEN';
        }
        window.location.hash = 'add-user';
    }

    function closePopup() {
        window.location.hash = '';
    }

    document.querySelector('main a.button[href="#add-user"]').addEventListener('click', function (e) {
        e.preventDefault();
        openPopup(null);
    });

    table.addEventListener('click', async function (e) {
        var edit = e.target.getAttribute('data-edit');
        var toggle = e.target.getAttribute('data-toggle');
        if (!edit && !toggle) return;
        e.preventDefault();
        var u = users.find(function (x) { return x.id === Number(edit || toggle); });
        if (edit) return openPopup(u);

        var verb = u.isActive ? 'Deactivate' : 'Activate';
        if (!confirm(verb + ' ' + u.fullName + '?' + (u.isActive ? ' They will not be able to log in.' : ''))) return;
        try {
            await api('users.php?id=' + u.id, 'PUT', { isActive: !u.isActive });
            load();
        } catch (err) {
            alert(err.message);
        }
    });

    popupForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        error.hidden = true;

        var role;
        if (field('role-admin').checked) role = 'ADMIN';
        else if (field('role-staff').checked && field('dept-hostel').checked) role = 'STAFF_HOSTEL';
        else if (field('role-staff').checked && field('dept-canteen').checked) role = 'STAFF_CANTEEN';
        else {
            error.textContent = field('role-staff').checked ? 'Choose Hostel Staff or Canteen Staff for a staff account.' : 'Choose a system role.';
            error.hidden = false;
            return;
        }

        var body = {
            firstName: field('first').value.trim(),
            lastName: field('last').value.trim(),
            phone: field('contact').value.trim(),
            email: field('email').value.trim(),
            role: role,
        };
        if (editingId === null) {
            body.username = field('username').value.trim();
            body.password = field('password').value;
        } else {
            var editing = users.find(function (x) { return x.id === editingId; });
            if (editing.role !== role) body.department = '';
            if (field('password').value) body.newPassword = field('password').value;
        }

        saveBtn.disabled = true;
        try {
            if (editingId === null) await api('users.php', 'POST', body);
            else await api('users.php?id=' + editingId, 'PUT', body);
            closePopup();
            load();
        } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
        }
        saveBtn.disabled = false;
    });

    popupForm.querySelector('.actions a.button').addEventListener('click', function (e) {
        e.preventDefault();
        closePopup();
    });

    filter.addEventListener('submit', function (e) {
        e.preventDefault();
        load();
    });
    field('sort').addEventListener('change', load);
    var timer;
    field('search').addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(load, 300);
    });

    load();
})();
