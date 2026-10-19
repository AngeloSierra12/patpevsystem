var API = 'api/';
var currentUser = null;

async function api(path, method, body) {
    if (!method) {
        method = 'GET';
    }

    var options = { method: method, headers: {} };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    var response;
    try {
        response = await fetch(API + path, options);
    } catch (error) {
        throw new Error('Cannot reach the server. Is Apache running in XAMPP?');
    }

    var data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (response.status === 401 && path !== 'login.php') {
        window.location.href = 'index.html';
        throw new Error(data.error || 'Please log in first');
    }
    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong (' + response.status + ')');
    }
    return data;
}

function hideNavLinks(pages) {
    var links = document.querySelectorAll('#nav-bar a');
    for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        if (pages.indexOf(href) !== -1) {
            links[i].style.display = 'none';
        }
    }
}

async function startPage() {
    var data = await api('me.php');
    currentUser = data.user;

    var firstName = currentUser.fullName.split(' ')[0];
    var button = document.querySelector('.dropbtn');
    if (button) {
        button.innerHTML = 'Hi, ' + esc(firstName) + ' &#9662;';
    }

    var who = document.getElementById('who');
    if (who) {
        who.innerHTML = esc(currentUser.fullName) + '<br><span>' + esc(currentUser.roleName) + '</span>';
    }

    var logout = document.getElementById('logout');
    if (logout) {
        logout.addEventListener('click', async function (event) {
            event.preventDefault();
            try {
                await api('logout.php', 'POST', {});
            } catch (error) {
            }
            window.location.href = 'index.html';
        });
    }

    if (currentUser.role === 'ADMIN') {
        hideNavLinks(['inventory.html', 'suppliers.html']);
    } else {
        hideNavLinks(['reports.html', 'audit-trail.html', 'users.html']);
    }
    return currentUser;
}

function adminOnly(message) {
    if (!message) {
        message = 'Only administrators can open this page.';
    }

    var main = document.querySelector('main');
    var title = '';
    if (main.querySelector('h1')) {
        title = main.querySelector('h1').textContent;
    }

    main.innerHTML = '<h1>' + esc(title) + '</h1>' +
        '<div class="box"><p>' + esc(message) + '</p>' +
        '<a class="more" href="dashboard.html">Back to the dashboard</a></div>';
}

function showError(where, error) {
    if (where) {
        where.innerHTML = '<p class="small" style="color:#c0392b">' + esc(error.message) + '</p>';
    }
}

function esc(text) {
    if (text === null || text === undefined) {
        text = '';
    }
    text = String(text);
    text = text.replace(/&/g, '&amp;');
    text = text.replace(/</g, '&lt;');
    text = text.replace(/>/g, '&gt;');
    text = text.replace(/"/g, '&quot;');
    text = text.replace(/'/g, '&#39;');
    return text;
}

var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function shortDate(value) {
    if (!value) {
        return '-';
    }
    var parts = value.slice(0, 10).split('-');
    return MONTHS[Number(parts[1]) - 1] + ' ' + Number(parts[2]);
}

function longDate(value) {
    var parts = value.slice(0, 10).split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return FULL_DAYS[date.getDay()] + ', ' + FULL_MONTHS[date.getMonth()] + ' ' + date.getDate() + ', ' + parts[0];
}

function todayText() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
}

function dateTime(value) {
    if (!value) {
        return '-';
    }
    return value.slice(0, 16);
}

function money(value) {
    var number = Number(value || 0);
    var decimals = 2;
    if (Number.isInteger(number)) {
        decimals = 0;
    }
    return 'Php ' + number.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
}

function qty(value) {
    return Number(value).toLocaleString('en-PH', { maximumFractionDigits: 3 });
}

function unitName(value, unit) {
    if (Math.abs(Number(value)) === 1 && /s$/.test(unit)) {
        return unit.slice(0, -1);
    }
    return unit;
}

function place(location) {
    if (location === 'HOSTEL') {
        return 'Hostel';
    }
    if (location === 'CANTEEN') {
        return 'Canteen';
    }
    return 'Canteen and hostel';
}

function addErrorLine(form) {
    var error = document.createElement('p');
    error.style.color = '#c0392b';
    error.hidden = true;
    form.insertBefore(error, form.querySelector('.actions'));
    return error;
}

function showFormError(errorLine, message) {
    errorLine.textContent = message;
    errorLine.hidden = false;
}

function makeOptions(select, options, firstText) {
    var html = '';
    if (firstText) {
        html += '<option value="">' + esc(firstText) + '</option>';
    }
    for (var i = 0; i < options.length; i++) {
        html += '<option value="' + esc(options[i][0]) + '">' + esc(options[i][1]) + '</option>';
    }
    select.innerHTML = html;
}

function openPopup(id) {
    window.location.hash = id;
}

function closePopup() {
    window.location.hash = '';
}
