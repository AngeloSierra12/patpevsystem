var API = 'api/';
var currentUser = null;

async function api(path, method, body) {
    var options = { method: method || 'GET', headers: {} };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    var res;
    try {
        res = await fetch(API + path, options);
    } catch (e) {
        throw new Error('Cannot reach the server. Is Apache running in XAMPP?');
    }
    var data = await res.json().catch(function () { return {}; });
    if (res.status === 401 && path !== 'login.php') {
        window.location.href = 'index.html';
        throw new Error(data.error || 'Please log in first');
    }
    if (!res.ok) throw new Error(data.error || 'Something went wrong (' + res.status + ')');
    return data;
}

async function startPage() {
    var data = await api('me.php');
    currentUser = data.user;

    var first = currentUser.fullName.split(' ')[0];
    var btn = document.querySelector('.dropbtn');
    if (btn) btn.innerHTML = 'Hi, ' + esc(first) + ' &#9662;';
    var who = document.getElementById('who');
    if (who) who.innerHTML = esc(currentUser.fullName) + '<br><span>' + esc(currentUser.roleName) + '</span>';

    var logout = document.getElementById('logout');
    if (logout) {
        logout.addEventListener('click', async function (e) {
            e.preventDefault();
            try { await api('logout.php', 'POST', {}); } catch (err) { }
            window.location.href = 'index.html';
        });
    }

    if (currentUser.role !== 'ADMIN') {
        document.querySelectorAll('#nav-bar a').forEach(function (a) {
            var href = a.getAttribute('href') || '';
            if (href === 'reports.html' || href === 'audit-trail.html' || href === 'users.html') a.style.display = 'none';
        });
    }
    return currentUser;
}

function adminOnly(message) {
    var main = document.querySelector('main');
    var title = main.querySelector('h1') ? main.querySelector('h1').textContent : '';
    main.innerHTML = '<h1>' + esc(title) +
        '</h1><div class="box"><p>' + esc(message || 'Only administrators can open this page.') +
        '</p><a class="more" href="dashboard.html">Back to the dashboard</a></div>';
}

function showError(where, err) {
    if (where) where.innerHTML = '<p class="small" style="color:#c0392b">' + esc(err.message) + '</p>';
}

function esc(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function shortDate(value) {
    if (!value) return '-';
    var p = value.slice(0, 10).split('-');
    return MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]);
}

function longDate(value) {
    var p = value.slice(0, 10).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return FULL_DAYS[d.getDay()] + ', ' + FULL_MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + p[0];
}

function dateTime(value) {
    return value ? value.slice(0, 16) : '-';
}

function money(value) {
    var n = Number(value || 0);
    var decimals = Number.isInteger(n) ? 0 : 2;
    return 'Php ' + n.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
}

function qty(value) {
    return Number(value).toLocaleString('en-PH', { maximumFractionDigits: 3 });
}

function place(location) {
    return location === 'HOSTEL' ? 'Hostel' : location === 'CANTEEN' ? 'Canteen' : 'Canteen and hostel';
}

function words(code) {
    if (!code) return '';
    var s = String(code).replace(/_/g, ' ').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
}
