var AUDIT_TYPES = {
    'All actions': 'all',
    'Sign-ins': 'signins',
    'Deliveries': 'deliveries',
    'Stock out': 'stockout',
    'Item counts': 'counts',
    'Items': 'items',
    'Suppliers': 'suppliers',
    'User accounts': 'users'
};

var auditPageNumber = 1;
var auditTable;
var auditCount;
var olderLink;
var newerLink;
var latestRequest = 0;

function auditRow(entry) {
    var time = dateTime(entry.time);
    if (entry.archived) {
        time += '<br><span class="small">archived</span>';
    }

    var result = 'OK';
    if (entry.result === 'FAILED') {
        result = '<span class="tag red">Failed</span>';
    }

    return '<tr><td>' + time + '</td>' +
        '<td>' + esc(entry.username) + '<br><span class="small">' + esc(entry.roleName) + '</span></td>' +
        '<td>' + esc(entry.actionLabel) + '</td>' +
        '<td>' + esc(entry.description || '-') + '</td>' +
        '<td>' + result + '</td></tr>';
}

async function loadAudit() {
    var type = AUDIT_TYPES[document.getElementById('type').value];
    if (!type) {
        type = 'all';
    }

    var params = new URLSearchParams({
        search: document.getElementById('search').value.trim(),
        from: document.getElementById('from').value,
        to: document.getElementById('to').value,
        type: type,
        page: auditPageNumber
    });

    latestRequest = latestRequest + 1;
    var thisRequest = latestRequest;

    var data;
    try {
        data = await api('audit.php?' + params);
    } catch (error) {
        if (thisRequest !== latestRequest) {
            return;
        }
        showError(auditCount, error);
        return;
    }

    if (thisRequest !== latestRequest) {
        return;
    }

    var firstShown = (data.page - 1) * data.perPage + 1;
    var lastShown = (data.page - 1) * data.perPage + data.entries.length;
    if (data.total > 0) {
        auditCount.textContent = 'Showing ' + firstShown + ' to ' + lastShown + ' of ' + data.total;
    } else {
        auditCount.textContent = 'No entries found';
    }

    var html = '<tr><th>Time</th><th>User</th><th>Action</th><th>Record</th><th>Result</th></tr>';
    for (var i = 0; i < data.entries.length; i++) {
        html += auditRow(data.entries[i]);
    }
    auditTable.innerHTML = html;

    if (lastShown < data.total) {
        olderLink.style.display = '';
    } else {
        olderLink.style.display = 'none';
    }
    if (data.page > 1) {
        newerLink.style.display = '';
    } else {
        newerLink.style.display = 'none';
    }
}

async function setupAuditPage() {
    var user;
    try {
        user = await startPage();
    } catch (error) {
        return;
    }
    if (user.role !== 'ADMIN') {
        adminOnly();
        return;
    }

    var filterForm = document.getElementById('filter');
    filterForm.removeAttribute('action');
    auditTable = document.querySelector('main table');
    auditCount = document.querySelector('main p.small');

    olderLink = document.getElementById('older');
    newerLink = document.createElement('a');
    newerLink.href = '#';
    newerLink.innerHTML = '&lt; Newer entries';
    newerLink.style.marginRight = '16px';
    olderLink.parentNode.insertBefore(newerLink, olderLink);

    olderLink.addEventListener('click', function (event) {
        event.preventDefault();
        auditPageNumber = auditPageNumber + 1;
        loadAudit();
        window.scrollTo(0, 0);
    });

    newerLink.addEventListener('click', function (event) {
        event.preventDefault();
        if (auditPageNumber > 1) {
            auditPageNumber = auditPageNumber - 1;
        }
        loadAudit();
        window.scrollTo(0, 0);
    });

    filterForm.addEventListener('submit', function (event) {
        event.preventDefault();
        auditPageNumber = 1;
        loadAudit();
    });

    var timer;
    document.getElementById('search').addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
            auditPageNumber = 1;
            loadAudit();
        }, 400);
    });

    setupArchive();
    loadAudit();
}

function setupArchive() {
    var button = document.getElementById('archive-btn');
    var text = document.getElementById('archive-text');
    button.addEventListener('click', async function (event) {
        event.preventDefault();
        if (!confirm('Move audit entries older than 90 days to the archive? They will still show up in searches.')) {
            return;
        }
        try {
            var data = await api('audit.php', 'POST', { action: 'archive', days: 90 });
            if (data.archived === 0) {
                text.textContent = 'Nothing to archive: there are no entries older than 90 days yet.';
            } else {
                text.textContent = 'Moved ' + data.archived + ' entries to the archive. They are still searchable.';
            }
            auditPageNumber = 1;
            loadAudit();
        } catch (error) {
            text.textContent = error.message;
        }
    });
}

setupAuditPage();
