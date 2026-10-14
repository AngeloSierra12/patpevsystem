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

    var form = document.getElementById('filter');
    form.removeAttribute('action');
    var table = document.querySelector('main table');
    var count = document.querySelector('main p.small');
    var older = document.getElementById('older');
    var newer = document.createElement('a');
    newer.href = '#';
    newer.innerHTML = '&lt; Newer entries';
    newer.style.marginRight = '16px';
    older.parentNode.insertBefore(newer, older);
    var page = 1;

    var TYPES = {
        'All actions': 'all',
        'Sign-ins': 'signins',
        'Deliveries': 'deliveries',
        'Stock out': 'stockout',
        'Item counts': 'counts',
        'Items': 'items',
        'User accounts': 'users',
    };

    async function load() {
        var params = new URLSearchParams({
            search: document.getElementById('search').value.trim(),
            from: document.getElementById('from').value,
            to: document.getElementById('to').value,
            type: TYPES[document.getElementById('type').value] || 'all',
            page: page,
        });
        try {
            var data = await api('audit.php?' + params);
        } catch (err) {
            showError(count, err);
            return;
        }

        var shownUpTo = (data.page - 1) * data.perPage + data.entries.length;
        count.textContent = data.total ? 'Showing ' + ((data.page - 1) * data.perPage + 1) + ' to ' + shownUpTo + ' of ' + data.total : 'No entries found';

        table.innerHTML = '<tr><th>Time</th><th>User</th><th>Action</th><th>Record</th><th>Result</th></tr>' +
            data.entries.map(function (e) {
                var result = e.result === 'FAILED'
                    ? '<span class="tag red">Failed</span>'
                    : 'OK';
                return '<tr><td>' + dateTime(e.time) + (e.archived ? '<br><span class="small">archived</span>' : '') + '</td>' +
                    '<td>' + esc(e.username) + '<br><span class="small">' + esc(e.roleName) + '</span></td>' +
                    '<td>' + esc(e.actionLabel) + '</td>' +
                    '<td>' + esc(e.description || '-') + '</td>' +
                    '<td>' + result + '</td></tr>';
            }).join('');

        older.style.display = shownUpTo < data.total ? '' : 'none';
        newer.style.display = data.page > 1 ? '' : 'none';
    }

    older.addEventListener('click', function (e) {
        e.preventDefault();
        page++;
        load();
        window.scrollTo(0, 0);
    });

    newer.addEventListener('click', function (e) {
        e.preventDefault();
        page = Math.max(1, page - 1);
        load();
        window.scrollTo(0, 0);
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        page = 1;
        load();
    });

    var timer;
    document.getElementById('search').addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { page = 1; load(); }, 400);
    });

    load();
})();
