/* ============================================================================
 * users.js — User Management module
 * ----------------------------------------------------------------------------
 * WBS 2.0  |  2.4 User dashboard (account list, roles, permission control)
 * OWNER: Angelo Andrei P. Sierra
 *
 * Covers the four deliverables named in the project charter:
 *   - user account management       (create / edit / deactivate / delete)
 *   - assign user roles             (Admin / Staff / Guest)
 *   - user permission control       (per-account grants and revokes)
 *   - user information update
 *
 * Authentication (WBS 2.2) is NOT part of this module and no password is ever
 * handled here — see core/session.js.
 * ========================================================================== */
(function (App) {
  'use strict';

  var esc = App.Dom.esc;
  var Fmt = App.Fmt;
  var RBAC = App.RBAC;

  var user;                       // the signed-in account
  var filters = { q: '', role: 'all', status: 'all' };

  var ROLE_ICONS = { admin: 'shield', staff: 'users', guest: 'account' };

  var STATUS_BADGE = {
    active:    { cls: 'ok',     label: 'Active' },
    inactive:  { cls: 'warn',   label: 'Inactive' },
    suspended: { cls: 'danger', label: 'Suspended' }
  };

  /* --- boot ---------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    user = App.Shell.mount({
      title: 'User Management',
      crumb: 'Accounts, roles and permissions',
      nav: 'users',
      requires: 'users.view'
    });
    if (!user) return;

    bindControls();
    renderRoleNotice();
    renderRoleCards();
    renderTable();

    if (/action=new/.test(location.search) && RBAC.can(user, 'users.create')) {
      openUserModal(null);
    }
  });

  function bindControls() {
    var search = document.getElementById('search');
    var t;
    search.addEventListener('input', function () {
      /* debounced so a long list is not re-rendered on every keystroke */
      clearTimeout(t);
      t = setTimeout(function () {
        filters.q = search.value.trim().toLowerCase();
        renderTable();
      }, 160);
    });

    document.getElementById('filterRole').addEventListener('change', function (e) {
      filters.role = e.target.value;
      renderTable();
    });
    document.getElementById('filterStatus').addEventListener('change', function (e) {
      filters.status = e.target.value;
      renderTable();
    });

    document.getElementById('btnMatrix').addEventListener('click', openMatrixModal);

    var btnNew = document.getElementById('btnNew');
    if (btnNew) btnNew.addEventListener('click', function () { openUserModal(null); });
  }

  /* --- read-only notice for roles that may look but not touch -------------- */
  function renderRoleNotice() {
    var canEdit = RBAC.canAny(user, ['users.create', 'users.edit', 'users.delete']);
    if (canEdit) return;

    document.getElementById('roleNotice').innerHTML =
      '<div class="notice notice--accent">' +
        '<span class="notice__icon">' + App.Icons.get('eye', { size: 15 }) + '</span>' +
        '<div>' +
          '<div class="notice__title">Read-only access</div>' +
          'You are signed in as <strong>' + esc(RBAC.roleLabel(user.role)) +
          '</strong>, which holds <code>users.view</code> but none of the ' +
          'management permissions. Accounts are listed, but every control that ' +
          'would change one is hidden or disabled.' +
        '</div>' +
      '</div>';
  }

  /* --- role summary cards -------------------------------------------------- */
  function renderRoleCards() {
    var counts = App.Store.users.countByRole();

    document.getElementById('roleCards').innerHTML =
      RBAC.ROLE_ORDER.map(function (key) {
        var role = RBAC.ROLES[key];
        return '' +
          '<article class="role-card">' +
            '<div class="role-card__head">' +
              '<span class="role-card__icon">' +
                App.Icons.get(ROLE_ICONS[key], { size: 16 }) + '</span>' +
              '<span class="role-card__name">' + esc(role.label) + '</span>' +
              '<span class="role-card__count">' + counts[key] +
                ' account' + (counts[key] === 1 ? '' : 's') + '</span>' +
            '</div>' +
            '<p class="role-card__desc">' + esc(role.description) + '</p>' +
            '<div class="role-card__perms">' + role.permissions.length +
              ' of ' + RBAC.ALL.length + ' permissions</div>' +
          '</article>';
      }).join('');
  }

  /* --- the account table (2.4) --------------------------------------------- */
  function visibleUsers() {
    return App.Store.users.list().filter(function (u) {
      if (filters.role !== 'all' && u.role !== filters.role) return false;
      if (filters.status !== 'all' && u.status !== filters.status) return false;
      if (!filters.q) return true;
      return [u.fullName, u.username, u.email, u.department, u.id]
        .join(' ').toLowerCase().indexOf(filters.q) !== -1;
    });
  }

  function renderTable() {
    var list = visibleUsers();
    var total = App.Store.users.list().length;
    var body = document.getElementById('userRows');

    document.getElementById('resultCount').textContent =
      list.length === total
        ? total + ' accounts'
        : list.length + ' of ' + total + ' accounts';

    var roleCounts = App.Store.users.countByRole();
    App.Shell.setMeta([
      ['Accounts', total],
      ['Admin', roleCounts.admin],
      ['Staff', roleCounts.staff],
      ['Guest', roleCounts.guest]
    ]);

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7">' +
        '<div class="empty">' +
          '<div class="empty__icon">' + App.Icons.get('search', { size: 26 }) + '</div>' +
          '<div class="empty__title">No accounts match</div>' +
          '<div class="empty__text">Try a different search term, or reset the ' +
          'role and status filters.</div>' +
        '</div></td></tr>';
      return;
    }

    body.innerHTML = list.map(rowFor).join('');
    App.Shell.hydrateIcons(body);
    App.RBAC.applyTo(body, user);
    wireRowActions(body);
    renderFoot(list);
  }

  function rowFor(u) {
    var status = STATUS_BADGE[u.status] || STATUS_BADGE.active;
    var grants = (u.grants || []).length;
    var revokes = (u.revokes || []).length;
    var isSelf = u.id === user.id;

    var permSummary;
    if (!grants && !revokes) {
      permSummary = '<span class="cell-muted">·</span>';
    } else {
      permSummary =
        (grants ? '<span class="badge badge--ok">+' + grants + ' granted</span> ' : '') +
        (revokes ? '<span class="badge badge--danger">−' + revokes + ' revoked</span>' : '');
    }

    return '' +
      '<tr data-id="' + esc(u.id) + '">' +
        '<td>' +
          '<div class="cell-user">' +
            '<span class="avatar avatar--sm avatar--' + esc(u.role) + '">' +
              esc(Fmt.initials(u.fullName)) + '</span>' +
            '<div>' +
              '<div class="cell-user__name">' + esc(u.fullName) +
                (isSelf ? ' <span class="badge">You</span>' : '') + '</div>' +
              '<div class="cell-user__meta">' + esc(u.username) + ' · ' +
                esc(u.id) + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="badge badge--' +
          (u.role === 'admin' ? 'info' : u.role === 'staff' ? '' : 'accent') + '">' +
          esc(RBAC.roleLabel(u.role)) + '</span></td>' +
        '<td>' + esc(u.department || '—') +
          '<div class="cell-user__meta">' + esc(u.email) + '</div></td>' +
        '<td><span class="badge badge--' + status.cls + '">' +
          '<span class="badge__dot"></span>' + status.label + '</span></td>' +
        '<td>' + permSummary + '</td>' +
        '<td class="cell-muted nowrap">' +
          (u.lastLogin ? esc(u.lastLogin) : 'Never') + '</td>' +
        '<td>' +
          '<div class="table__actions">' +
            '<button class="btn btn--sm" data-act="perms" data-perm="users.perm.manage" ' +
              'data-perm-mode="disable" data-icon="key" title="Manage permissions">' +
              'Permissions</button>' +
            '<button class="btn btn--sm" data-act="edit" data-perm="users.edit" ' +
              'data-perm-mode="disable" data-icon="edit" title="Edit account">Edit</button>' +
            '<button class="btn btn--sm" data-act="delete" data-perm="users.delete" ' +
              'data-perm-mode="disable" aria-label="Delete ' + esc(u.fullName) + '" ' +
              'data-icon="trash" title="Delete account"></button>' +
          '</div>' +
        '</td>' +
      '</tr>';
  }

  function wireRowActions(root) {
    App.Dom.on(root, 'click', '[data-act]', function (e, btn) {
      var id = btn.closest('tr').dataset.id;
      var act = btn.dataset.act;
      if (act === 'edit') openUserModal(id);
      else if (act === 'perms') openPermissionsModal(id);
      else if (act === 'delete') confirmDelete(id);
    });
  }

  function renderFoot(list) {
    var suspended = list.filter(function (u) { return u.status !== 'active'; }).length;
    var custom = list.filter(function (u) {
      return (u.grants || []).length || (u.revokes || []).length;
    }).length;

    document.getElementById('tableFoot').innerHTML =
      '<span>' + suspended + ' not active, ' + custom +
        ' with custom permissions</span>' +
      '';
  }

  /* ===================================================================== *
   * Create / edit account
   * ===================================================================== */
  function openUserModal(id) {
    var existing = id ? App.Store.users.get(id) : null;
    var canAssignRole = RBAC.can(user, 'users.role.assign');
    var isSelf = existing && existing.id === user.id;

    var roleOptions = RBAC.ROLE_ORDER.map(function (r) {
      return '<option value="' + r + '"' +
        (existing && existing.role === r ? ' selected' : '') + '>' +
        esc(RBAC.ROLES[r].label) + '</option>';
    }).join('');

    var statusOptions = Object.keys(STATUS_BADGE).map(function (s) {
      return '<option value="' + s + '"' +
        (existing && existing.status === s ? ' selected' : '') + '>' +
        esc(STATUS_BADGE[s].label) + '</option>';
    }).join('');

    var body =
      '<div class="field-row">' +
        field('fName', 'Full name', 'text', existing ? existing.fullName : '', true,
              'As it should appear on records and receipts.') +
        field('fUsername', 'Username', 'text', existing ? existing.username : '', true,
              'Must be unique across all accounts.') +
      '</div>' +

      '<div class="field-row">' +
        field('fEmail', 'Email address', 'email', existing ? existing.email : '', true) +
        field('fContact', 'Contact number', 'tel', existing ? existing.contact : '', false) +
      '</div>' +

      field('fDept', 'Department / affiliation', 'text',
            existing ? existing.department : '', false,
            'e.g. IGP PATVEP Hostel, University Canteen, External Guest') +

      '<div class="field-row">' +
        '<div class="field">' +
          '<label class="field__label" for="fRole">Assigned role' +
            (canAssignRole ? ' <span class="field__req">*</span>' : '') + '</label>' +
          '<select class="select" id="fRole"' + (canAssignRole ? '' : ' disabled') + '>' +
            roleOptions + '</select>' +
          '<div class="field__hint" id="roleHint"></div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="fStatus">Account status</label>' +
          '<select class="select" id="fStatus">' + statusOptions + '</select>' +
          '<div class="field__hint">Only <strong>Active</strong> accounts pass any ' +
            'permission check.</div>' +
        '</div>' +
      '</div>' +

      (isSelf
        ? '<div class="notice notice--accent mb-0">' +
            '<span class="notice__icon">' + App.Icons.get('alert', { size: 15 }) + '</span>' +
            '<div><div class="notice__title">This is your own account</div>' +
            'Lowering your own role or status would immediately remove your access ' +
            'to this page, so those two fields are locked.</div>' +
          '</div>'
        : '') +

      '<div class="notice notice--muted mt-2 mb-0">' +
        '<span class="notice__icon">' + App.Icons.get('lock', { size: 15 }) + '</span>' +
        '<div><div class="notice__title">No password field</div>' +
        'Sign-in and credential handling are not implemented in this build. ' +
        'This form manages identity and access only.</div>' +
      '</div>';

    App.Shell.openModal({
      title: existing ? 'Edit user account' : 'New user account',
      sub: existing ? existing.id : 'The account is created with role defaults',
      body: body,
      wide: true,
      footer:
        '<button class="btn" data-act="cancel">Cancel</button>' +
        '<button class="btn btn--primary" data-act="save">' +
          (existing ? 'Save changes' : 'Create account') + '</button>',
      onMount: function (root, handle) {
        App.Shell.hydrateIcons(root);

        var f = {
          name: root.querySelector('#fName'),
          username: root.querySelector('#fUsername'),
          email: root.querySelector('#fEmail'),
          contact: root.querySelector('#fContact'),
          dept: root.querySelector('#fDept'),
          role: root.querySelector('#fRole'),
          status: root.querySelector('#fStatus')
        };

        if (isSelf) { f.role.disabled = true; f.status.disabled = true; }

        function showRoleHint() {
          var r = RBAC.ROLES[f.role.value];
          root.querySelector('#roleHint').textContent =
            r ? r.permissions.length + ' permissions by default' : '';
        }
        f.role.addEventListener('change', showRoleHint);
        showRoleHint();

        root.querySelector('[data-act="cancel"]').addEventListener('click', handle.close);

        root.querySelector('[data-act="save"]').addEventListener('click', function () {
          if (!validate(root, f, existing)) return;

          var data = {
            fullName: f.name.value.trim(),
            username: f.username.value.trim(),
            email: f.email.value.trim(),
            contact: f.contact.value.trim(),
            department: f.dept.value.trim()
          };
          /* a disabled <select> still has a value; only write it when allowed */
          if (!isSelf) {
            data.status = f.status.value;
            if (canAssignRole) data.role = f.role.value;
          }

          if (existing) {
            App.Store.users.update(existing.id, data);
            App.Shell.toast('Account updated: ' + data.fullName, 'ok');
          } else {
            if (!canAssignRole) data.role = 'guest';   // safest default
            var created = App.Store.users.create(data);
            App.Shell.toast('Account created: ' + created.username, 'ok');
          }

          handle.close();
          renderRoleCards();
          renderTable();
        });
      }
    });

    function field(id, label, type, value, required, hint) {
      return '<div class="field">' +
        '<label class="field__label" for="' + id + '">' + esc(label) +
          (required ? ' <span class="field__req">*</span>' : '') + '</label>' +
        '<input class="input" id="' + id + '" type="' + type + '" ' +
          'value="' + esc(value || '') + '" maxlength="80"' +
          (type === 'email' ? ' autocomplete="email"' : '') + '>' +
        (hint ? '<div class="field__hint">' + hint + '</div>' : '') +
        '<div class="field__error" id="' + id + 'Err" hidden></div>' +
      '</div>';
    }
  }

  /* Validation runs on save and focuses the first bad field (WCAG). */
  function validate(root, f, existing) {
    var problems = [];

    clearError(root, 'fName'); clearError(root, 'fUsername'); clearError(root, 'fEmail');

    if (!f.name.value.trim()) {
      problems.push(['fName', 'Full name is required.']);
    }

    var uname = f.username.value.trim();
    if (!uname) {
      problems.push(['fUsername', 'Username is required.']);
    } else if (!/^[a-z0-9._-]{3,}$/i.test(uname)) {
      problems.push(['fUsername',
        'Use at least 3 characters: letters, numbers, dot, dash or underscore.']);
    } else if (App.Store.users.usernameTaken(uname, existing ? existing.id : null)) {
      problems.push(['fUsername', 'That username is already taken.']);
    }

    var email = f.email.value.trim();
    if (!email) {
      problems.push(['fEmail', 'Email address is required.']);
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      problems.push(['fEmail', 'Enter a valid email address.']);
    }

    problems.forEach(function (p) { setError(root, p[0], p[1]); });

    if (problems.length) {
      var first = root.querySelector('#' + problems[0][0]);
      if (first) first.focus();
      return false;
    }
    return true;
  }

  function setError(root, id, message) {
    var input = root.querySelector('#' + id);
    var err = root.querySelector('#' + id + 'Err');
    if (input) input.classList.add('is-invalid');
    if (err) {
      err.hidden = false;
      err.innerHTML = App.Icons.get('alert', { size: 12 }) + esc(message);
    }
  }

  function clearError(root, id) {
    var input = root.querySelector('#' + id);
    var err = root.querySelector('#' + id + 'Err');
    if (input) input.classList.remove('is-invalid');
    if (err) { err.hidden = true; err.textContent = ''; }
  }

  /* ===================================================================== *
   * Per-account permission control
   * ===================================================================== */
  function openPermissionsModal(id) {
    var target = App.Store.users.get(id);
    if (!target) return;

    var editable = RBAC.can(user, 'users.perm.manage');
    /* working copies so Cancel really cancels */
    var grants = (target.grants || []).slice();
    var revokes = (target.revokes || []).slice();

    App.Shell.openModal({
      title: 'Permissions: ' + target.fullName,
      sub: RBAC.roleLabel(target.role) + ' · ' + target.id,
      wide: true,
      body: '<div id="permSummary"></div><div id="permGroups"></div>',
      footer:
        '<button class="btn" data-act="reset">Reset to role defaults</button>' +
        '<span class="flex-gap">' +
          '<button class="btn" data-act="cancel">Cancel</button>' +
          '<button class="btn btn--primary" data-act="save"' +
            (editable ? '' : ' disabled') + '>Save permissions</button>' +
        '</span>',
      footerSplit: true,
      onMount: function (root, handle) {
        var groupHost = root.querySelector('#permGroups');
        var summaryHost = root.querySelector('#permSummary');

        function draw() {
          /* a probe user carrying the unsaved grants/revokes, so explain()
             describes the state the admin is about to save */
          var probe = Object.assign({}, target, { grants: grants, revokes: revokes });

          summaryHost.innerHTML =
            '<div class="notice notice--muted">' +
              '<span class="notice__icon">' + App.Icons.get('info', { size: 15 }) + '</span>' +
              '<div>' +
                'Switches start from the <strong>' + esc(RBAC.roleLabel(target.role)) +
                '</strong> role. Turning one on adds a personal grant; turning one ' +
                'off adds a personal revoke. ' +
                '<strong>' + RBAC.effective(probe).length + '</strong> of ' +
                RBAC.ALL.length + ' permissions are currently in effect' +
                (target.status !== 'active'
                  ? ' <strong>(blocked, the account is ' +
                    esc(target.status) + ')</strong>'
                  : '') + '.' +
              '</div>' +
            '</div>';

          groupHost.innerHTML = RBAC.CATALOG.map(function (group) {
            return '' +
              '<section class="perm-group">' +
                '<div class="perm-group__head">' +
                  '<span class="perm-group__name">' + esc(group.group) + '</span>' +

                '</div>' +
                '<div class="perm-group__body">' +
                  group.items.map(function (item) {
                    var info = RBAC.explain(probe, item.key);
                    var on = RBAC.ROLES[target.role].permissions.indexOf(item.key) !== -1;
                    if (revokes.indexOf(item.key) !== -1) on = false;
                    if (grants.indexOf(item.key) !== -1) on = true;

                    return '' +
                      '<div class="perm-row">' +
                        '<div class="perm-row__text">' +
                          '<div class="perm-row__label">' + esc(item.label) + '</div>' +
                          '<div class="perm-row__key">' + esc(item.key) + '</div>' +
                        '</div>' +
                        '<span class="perm-row__source perm-row__source--' +
                          esc(info.source) + '" title="' + esc(info.reason) + '">' +
                          esc(sourceLabel(info.source)) + '</span>' +
                        '<label class="toggle">' +
                          '<input type="checkbox" data-key="' + esc(item.key) + '"' +
                            (on ? ' checked' : '') + (editable ? '' : ' disabled') +
                            ' aria-label="' + esc(item.label) + '">' +
                          '<span class="toggle__track"></span>' +
                        '</label>' +
                      '</div>';
                  }).join('') +
                '</div>' +
              '</section>';
          }).join('');
        }

        draw();

        App.Dom.on(groupHost, 'change', 'input[type="checkbox"]', function (e, box) {
          var key = box.dataset.key;
          var inRole = RBAC.ROLES[target.role].permissions.indexOf(key) !== -1;

          /* Only store a difference from the role. Matching the role default
             clears both lists, which keeps the record small and readable. */
          remove(grants, key); remove(revokes, key);
          if (box.checked && !inRole) grants.push(key);
          if (!box.checked && inRole) revokes.push(key);

          draw();
        });

        root.querySelector('[data-act="reset"]').addEventListener('click', function () {
          if (!editable) return;
          grants = []; revokes = [];
          draw();
          App.Shell.toast('Reverted to role defaults. Not saved yet.', 'info');
        });

        root.querySelector('[data-act="cancel"]').addEventListener('click', handle.close);

        root.querySelector('[data-act="save"]').addEventListener('click', function () {
          App.Store.users.update(target.id, { grants: grants, revokes: revokes });
          App.Shell.toast('Permissions saved for ' + target.fullName + '.', 'ok');
          handle.close();
          renderTable();
          /* if the admin just changed their own access, re-apply it immediately */
          if (target.id === user.id) location.reload();
        });
      }
    });

    function remove(arr, v) {
      var i = arr.indexOf(v);
      if (i !== -1) arr.splice(i, 1);
    }
  }

  function sourceLabel(source) {
    return { role: 'From role', grant: 'Granted', revoke: 'Revoked',
             status: 'Blocked', 'default': 'Not in role' }[source] || source;
  }

  /* ===================================================================== *
   * Delete, with the guard rails a real system needs
   * ===================================================================== */
  function confirmDelete(id) {
    var target = App.Store.users.get(id);
    if (!target) return;

    if (target.id === user.id) {
      App.Shell.toast('You cannot delete the account you are signed in as.', 'danger');
      return;
    }

    var activeAdmins = App.Store.users.list().filter(function (u) {
      return u.role === 'admin' && u.status === 'active';
    });
    if (target.role === 'admin' && activeAdmins.length <= 1) {
      App.Shell.toast('This is the last active administrator. Deletion blocked.', 'danger');
      return;
    }

    var bookings = App.Store.reservations.byGuest(target.id).filter(function (r) {
      return r.status !== 'cancelled' && r.status !== 'checked-out';
    });

    App.Shell.confirm({
      title: 'Delete this account?',
      sub: target.fullName + ' · ' + target.id,
      danger: true,
      confirmLabel: 'Delete account',
      html:
        'The account <strong>' + esc(target.username) + '</strong> (' +
        esc(RBAC.roleLabel(target.role)) + ') will be removed permanently. ' +
        'This cannot be undone.' +
        (bookings.length
          ? '<br><br><span style="color:var(--danger-700);font-weight:600">' +
            'Warning: ' + bookings.length + ' active reservation' +
            (bookings.length === 1 ? '' : 's') + ' reference this guest.</span> ' +
            'Deactivating the account instead keeps those records intact.'
          : ''),
      onConfirm: function () {
        App.Store.users.remove(target.id);
        App.Shell.toast('Account deleted: ' + target.username, 'ok');
        renderRoleCards();
        renderTable();
      }
    });
  }

  /* ===================================================================== *
   * Permission matrix — roles against the full catalogue
   * ===================================================================== */
  function openMatrixModal() {
    var rows = RBAC.CATALOG.map(function (group) {
      return '<tr><td colspan="4" style="background:var(--surface-2);' +
               'font-weight:600;font-size:11.5px">' +
               esc(group.group) + '</td></tr>' +
        group.items.map(function (item) {
          return '<tr>' +
            '<td><div class="perm-row__label">' + esc(item.label) + '</div>' +
              '<div class="perm-row__key">' + esc(item.key) + '</div></td>' +
            RBAC.ROLE_ORDER.map(function (r) {
              var has = RBAC.ROLES[r].permissions.indexOf(item.key) !== -1;
              return '<td style="text-align:center">' +
                (has
                  ? '<span style="color:var(--ok-700)" title="Allowed">' +
                      App.Icons.get('check', { size: 15 }) + '</span>'
                  : '<span style="color:var(--ink-300)" title="Denied">' +
                      App.Icons.get('close', { size: 14 }) + '</span>') +
              '</td>';
            }).join('') +
          '</tr>';
        }).join('');
    }).join('');

    App.Shell.openModal({
      title: 'Permission matrix',
      sub: 'Role defaults across all ' + RBAC.ALL.length + ' permissions',
      wide: true,
      body:
        '<div class="table-wrap">' +
          '<table class="table">' +
            '<thead><tr>' +
              '<th>Permission</th>' +
              RBAC.ROLE_ORDER.map(function (r) {
                return '<th style="text-align:center">' +
                  esc(RBAC.ROLES[r].label) + '</th>';
              }).join('') +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
        '<p class="text-sm text-muted mt-2">Individual accounts can differ from ' +
        'these defaults through per-user grants and revokes.</p>',
      footer: '<button class="btn btn--primary" data-act="close">Close</button>',
      onMount: function (root, handle) {
        root.querySelector('[data-act="close"]').addEventListener('click', handle.close);
      }
    });
  }
})(window.App = window.App || {});
