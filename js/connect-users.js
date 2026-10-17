var userList = [];
var resetRequests = [];
var editingUserId = null;
var loggedInUser = null;
var userTable;
var userCount;
var latestRequest = 0;
var userForm;
var userFormError;

function field(id) {
    return document.getElementById(id);
}

function findUser(id) {
    for (var i = 0; i < userList.length; i++) {
        if (userList[i].id === id) {
            return userList[i];
        }
    }
    return null;
}

function userRow(user) {
    var status = 'Active';
    if (!user.isActive) {
        status = '<span class="tag grey">Inactive</span>';
    }

    var actions = '<a href="#" data-edit="' + user.id + '">Edit</a>';
    if (user.id !== loggedInUser.id) {
        var toggleText = 'Activate';
        if (user.isActive) {
            toggleText = 'Deactivate';
        }
        actions += ' - <a href="#" data-toggle="' + user.id + '">' + toggleText + '</a>';
    }

    return '<tr><td>' + esc(user.fullName) + '</td>' +
        '<td>' + esc(user.phone || '-') + '</td>' +
        '<td>' + esc(user.email) + '</td>' +
        '<td>' + esc(user.roleName) + '</td>' +
        '<td>' + esc(user.department || '-') + '</td>' +
        '<td>' + status + '</td>' +
        '<td>' + actions + '</td></tr>';
}

async function loadUsers() {
    var sort = 'name';
    if (field('sort').value === 'Sort by role') {
        sort = 'role';
    } else if (field('sort').value === 'Sort by status') {
        sort = 'status';
    }

    var params = new URLSearchParams({ search: field('search').value.trim(), sort: sort });

    latestRequest = latestRequest + 1;
    var thisRequest = latestRequest;

    var data;
    try {
        data = await api('users.php?' + params);
    } catch (error) {
        if (thisRequest !== latestRequest) {
            return;
        }
        showError(userCount, error);
        return;
    }

    if (thisRequest !== latestRequest) {
        return;
    }

    userList = data.users;
    userCount.textContent = 'Showing ' + userList.length + ' of ' + data.total;

    var html = '<tr><th>Full Name</th><th>Contact No.</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr>';
    for (var i = 0; i < userList.length; i++) {
        html += userRow(userList[i]);
    }
    userTable.innerHTML = html;

    showResetRequests(data.resetRequests || []);
}

function showResetRequests(requests) {
    resetRequests = requests;
    var box = field('resets');
    if (requests.length === 0) {
        box.hidden = true;
        return;
    }

    var html = '';
    for (var i = 0; i < requests.length; i++) {
        var request = requests[i];
        var asked = 'asked on ' + dateTime(request.requestedAt);
        if (request.times > 1) {
            asked += ' (' + request.times + ' times)';
        }
        html += '<li><b>' + esc(request.user.fullName) + '</b> (' + esc(request.user.username) + ') ' + asked +
            ' <a href="#" data-reset="' + i + '">Reset password</a>';
        if (request.note) {
            html += '<span class="small">"' + esc(request.note) + '"</span>';
        }
        html += '</li>';
    }
    field('reset-list').innerHTML = html;
    box.hidden = false;
}

function openResetForm(user) {
    openUserForm(user);
    var passwordLabel = userForm.querySelector('label[for=password]');
    passwordLabel.innerHTML = '<b>New Password (give this to ' + esc(user.fullName.split(' ')[0]) + ')</b>';
    field('password').required = true;
    field('password').focus();
}

function openUserForm(user) {
    userFormError.hidden = true;
    userForm.reset();

    var passwordLabel = userForm.querySelector('label[for=password]');
    var saveButton = userForm.querySelector('button[type=submit]');
    var title = document.querySelector('#add-user h2');

    if (user === null) {
        editingUserId = null;
        title.textContent = 'Add User';
        saveButton.textContent = 'Save User';
        field('username').readOnly = false;
        field('password').required = true;
        passwordLabel.innerHTML = '<b>Default Password</b>';
    } else {
        editingUserId = user.id;
        title.textContent = 'Edit User';
        saveButton.textContent = 'Save Changes';
        field('username').readOnly = true;
        field('password').required = false;
        passwordLabel.innerHTML = '<b>New Password (leave blank to keep)</b>';

        var nameParts = user.fullName.split(' ');
        field('last').value = nameParts.pop();
        field('first').value = nameParts.join(' ');
        field('contact').value = user.phone || '';
        field('email').value = user.email;
        field('username').value = user.username;
        field('role-admin').checked = user.role === 'ADMIN';
        field('role-staff').checked = user.role !== 'ADMIN';
        field('dept-hostel').checked = user.role === 'STAFF_HOSTEL';
        field('dept-canteen').checked = user.role === 'STAFF_CANTEEN';
    }

    openPopup('add-user');
}

function chosenRole() {
    if (field('role-admin').checked) {
        return 'ADMIN';
    }
    if (field('role-staff').checked && field('dept-hostel').checked) {
        return 'STAFF_HOSTEL';
    }
    if (field('role-staff').checked && field('dept-canteen').checked) {
        return 'STAFF_CANTEEN';
    }
    return null;
}

async function saveUser(event) {
    event.preventDefault();
    userFormError.hidden = true;

    var role = chosenRole();
    if (role === null) {
        if (field('role-staff').checked) {
            showFormError(userFormError, 'Choose Hostel Staff or Canteen Staff for a staff account.');
        } else {
            showFormError(userFormError, 'Choose a system role.');
        }
        return;
    }

    var body = {
        firstName: field('first').value.trim(),
        lastName: field('last').value.trim(),
        phone: field('contact').value.trim(),
        email: field('email').value.trim(),
        role: role
    };

    if (editingUserId === null) {
        body.username = field('username').value.trim();
        body.password = field('password').value;
    } else {
        var editing = findUser(editingUserId);
        if (editing.role !== role) {
            body.department = '';
        }
        if (field('password').value) {
            body.newPassword = field('password').value;
        }
    }

    var saveButton = userForm.querySelector('button[type=submit]');
    saveButton.disabled = true;
    try {
        if (editingUserId === null) {
            await api('users.php', 'POST', body);
        } else {
            await api('users.php?id=' + editingUserId, 'PUT', body);
        }
        closePopup();
        loadUsers();
    } catch (error) {
        showFormError(userFormError, error.message);
    }
    saveButton.disabled = false;
}

async function toggleUser(user) {
    var question = 'Activate ' + user.fullName + '?';
    if (user.isActive) {
        question = 'Deactivate ' + user.fullName + '? They will not be able to log in.';
    }
    if (!confirm(question)) {
        return;
    }

    try {
        await api('users.php?id=' + user.id, 'PUT', { isActive: !user.isActive });
        loadUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function setupUsersPage() {
    try {
        loggedInUser = await startPage();
    } catch (error) {
        return;
    }
    if (loggedInUser.role !== 'ADMIN') {
        adminOnly();
        return;
    }

    var filterForm = document.getElementById('filter');
    filterForm.removeAttribute('action');
    userTable = document.querySelector('main > .box table');
    userCount = document.querySelector('main > .box p.small');
    userForm = document.querySelector('#add-user form');
    userForm.removeAttribute('action');
    userFormError = addErrorLine(userForm);

    document.querySelector('main a.button[href="#add-user"]').addEventListener('click', function (event) {
        event.preventDefault();
        openUserForm(null);
    });

    userTable.addEventListener('click', function (event) {
        var editId = event.target.getAttribute('data-edit');
        var toggleId = event.target.getAttribute('data-toggle');
        if (editId) {
            event.preventDefault();
            openUserForm(findUser(Number(editId)));
        } else if (toggleId) {
            event.preventDefault();
            toggleUser(findUser(Number(toggleId)));
        }
    });

    field('reset-list').addEventListener('click', function (event) {
        var index = event.target.getAttribute('data-reset');
        if (index !== null) {
            event.preventDefault();
            openResetForm(resetRequests[Number(index)].user);
        }
    });

    userForm.addEventListener('submit', saveUser);

    userForm.querySelector('.actions a.button').addEventListener('click', function (event) {
        event.preventDefault();
        closePopup();
    });

    filterForm.addEventListener('submit', function (event) {
        event.preventDefault();
        loadUsers();
    });
    field('sort').addEventListener('change', loadUsers);

    var timer;
    field('search').addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(loadUsers, 300);
    });

    loadUsers();
}

setupUsersPage();
