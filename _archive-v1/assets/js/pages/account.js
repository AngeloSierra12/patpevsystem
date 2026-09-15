/* ============================================================================
 * account.js — My Account (self-service view of the User Management module)
 * ----------------------------------------------------------------------------
 * WBS 2.4  |  OWNER: Angelo Andrei P. Sierra
 *
 * Every role reaches this page, because every role holds account.self.edit.
 * The important restriction: a user may update their own contact details but
 * may NOT change their own role, status or permissions. Those are decided by
 * an administrator on the User Management screen, which is what stops a guest
 * from promoting themselves.
 * ========================================================================== */
(function (App) {
  'use strict';

  var esc = App.Dom.esc;
  var Fmt = App.Fmt;
  var RBAC = App.RBAC;
  var user;

  document.addEventListener('DOMContentLoaded', function () {
    user = App.Shell.mount({
      title: 'My Account',
      crumb: 'Profile and effective permissions',
      nav: 'account',
      requires: 'account.self.edit'
    });
    if (!user) return;

    render();

    document.getElementById('btnEdit').addEventListener('click', openEditModal);
  });

  function render() {
    user = App.Session.current();     // refresh after any edit
    renderProfile();
    renderDetails();
    renderPermissions();
    renderBookings();

    App.Shell.setMeta([
      ['Role', RBAC.roleLabel(user.role)],
      ['Permissions', RBAC.effective(user).length + ' of ' + RBAC.ALL.length]
    ]);

    App.Shell.hydrateIcons(document);
    RBAC.applyTo(document, user);
  }

  function renderProfile() {
    var role = RBAC.ROLES[user.role];
    document.getElementById('profileCard').innerHTML =
      '<div class="profile-head">' +
        '<span class="avatar avatar--lg avatar--' + esc(user.role) + '">' +
          esc(Fmt.initials(user.fullName)) + '</span>' +
        '<div>' +
          '<div class="profile-head__name">' + esc(user.fullName) + '</div>' +
          '<div class="profile-head__meta">' + esc(user.email) + '</div>' +
          '<div class="flex-gap mt-1">' +
            '<span class="badge badge--info">' + esc(role.label) + '</span>' +
            '<span class="badge badge--' +
              (user.status === 'active' ? 'ok' : 'warn') + '">' +
              '<span class="badge__dot"></span>' + esc(Fmt.titleCase(user.status)) +
            '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<p class="text-sm text-muted mt-2" style="line-height:1.55">' +
        esc(role.description) + '</p>';
  }

  function renderDetails() {
    document.getElementById('detailsCard').innerHTML =
      '<div class="kv">' +
        kv('Account ID', '<code>' + esc(user.id) + '</code>') +
        kv('Username', esc(user.username)) +
        kv('Email address', esc(user.email)) +
        kv('Contact number', esc(user.contact || '—')) +
        kv('Department', esc(user.department || '—')) +
        kv('Role', esc(RBAC.roleLabel(user.role))) +
        kv('Status', esc(Fmt.titleCase(user.status))) +
        kv('Account created', esc(Fmt.longDate(user.createdAt))) +
        kv('Last sign-in', esc(user.lastLogin || 'No record')) +
      '</div>' +
      '<div class="notice notice--muted mt-2 mb-0">' +
        '<span class="notice__icon">' + App.Icons.get('lock', { size: 15 }) + '</span>' +
        '<div>' +
          '<div class="notice__title">Role and status are not self-editable</div>' +
          'You can update your own contact details, but only an administrator can ' +
          'change your role, your status or your individual permissions. ' +
          'Password management is not implemented in this build.' +
        '</div>' +
      '</div>';

    function kv(k, v) {
      return '<div class="kv__k">' + k + '</div><div class="kv__v">' + v + '</div>';
    }
  }

  /* --- effective permissions, grouped, with the reason for each ------------ */
  function renderPermissions() {
    var held = RBAC.effective(user);

    var html = '<div class="flex-gap mb-2">' +
      '<span class="badge badge--ok">' + held.length + ' allowed</span>' +
      '<span class="badge">' + (RBAC.ALL.length - held.length) + ' denied</span>' +
      ((user.grants || []).length
        ? '<span class="badge badge--info">+' + user.grants.length + ' personal grant' +
          (user.grants.length === 1 ? '' : 's') + '</span>' : '') +
      ((user.revokes || []).length
        ? '<span class="badge badge--danger">−' + user.revokes.length + ' revoked</span>' : '') +
    '</div>';

    html += RBAC.CATALOG.map(function (group) {
      var rows = group.items.map(function (item) {
        var info = RBAC.explain(user, item.key);
        return '' +
          '<div class="perm-row">' +
            '<span style="color:' +
              (info.allowed ? 'var(--ok-700)' : 'var(--ink-300)') + '" ' +
              'aria-label="' + (info.allowed ? 'Allowed' : 'Denied') + '">' +
              App.Icons.get(info.allowed ? 'check' : 'close', { size: 14 }) +
            '</span>' +
            '<div class="perm-row__text">' +
              '<div class="perm-row__label"' +
                (info.allowed ? '' : ' style="color:var(--ink-400)"') + '>' +
                esc(item.label) + '</div>' +
              '<div class="perm-row__key">' + esc(item.key) + '</div>' +
            '</div>' +
            '<span class="perm-row__source perm-row__source--' + esc(info.source) + '" ' +
              'title="' + esc(info.reason) + '">' + esc(sourceLabel(info.source)) + '</span>' +
          '</div>';
      }).join('');

      var allowedInGroup = group.items.filter(function (i) {
        return RBAC.can(user, i.key);
      }).length;

      return '' +
        '<section class="perm-group">' +
          '<div class="perm-group__head">' +
            '<span class="perm-group__name">' + esc(group.group) + '</span>' +
            '<span class="badge badge--' +
              (allowedInGroup ? 'ok' : '') + '">' + allowedInGroup + '/' +
              group.items.length + '</span>' +

          '</div>' +
          '<div class="perm-group__body">' + rows + '</div>' +
        '</section>';
    }).join('');

    document.getElementById('permCard').innerHTML = html;
  }

  function sourceLabel(source) {
    return { role: 'From role', grant: 'Granted to you', revoke: 'Revoked',
             status: 'Blocked', 'default': 'Not in role' }[source] || source;
  }

  /* --- a guest's own bookings --------------------------------------------- */
  function renderBookings() {
    var mine = App.Store.reservations.byGuest(user.id);
    var card = document.getElementById('bookingsCard');

    if (!mine.length || !RBAC.can(user, 'reservations.view.own')) {
      card.hidden = true;
      return;
    }
    card.hidden = false;

    var today = App.Dates.todayIso();
    mine.sort(function (a, b) { return App.Dates.diffDays(b.checkIn, a.checkIn); });

    document.getElementById('bookingsBody').innerHTML = mine.map(function (r) {
      var past = App.Dates.diffDays(r.checkOut, today) > 0;
      var badge = r.status === 'cancelled' ? 'danger'
                : r.status === 'pending' ? 'warn'
                : past ? '' : 'ok';
      return '' +
        '<div class="alert-row">' +
          '<span class="badge badge--' + badge + '">' +
            esc(Fmt.titleCase(r.status)) + '</span>' +
          '<div class="alert-row__body">' +
            '<div class="alert-row__title">Room ' +
              esc(App.Store.rooms.codeOf(r.roomId)) + ' · ' + esc(r.id) + '</div>' +
            '<div class="alert-row__meta">' + esc(Fmt.longDate(r.checkIn)) +
              ' to ' + esc(Fmt.longDate(r.checkOut)) + ' · ' + r.pax + ' pax</div>' +
          '</div>' +
          '<div class="alert-row__value">' + esc(Fmt.peso(r.total)) + '</div>' +
        '</div>';
    }).join('');
  }

  /* --- edit own details ---------------------------------------------------- */
  function openEditModal() {
    App.Shell.openModal({
      title: 'Edit my details',
      sub: user.id + ' · ' + RBAC.roleLabel(user.role),
      body:
        '<div class="field">' +
          '<label class="field__label" for="aName">Full name ' +
            '<span class="field__req">*</span></label>' +
          '<input class="input" id="aName" maxlength="80" value="' +
            esc(user.fullName) + '">' +
          '<div class="field__error" id="aNameErr" hidden></div>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field">' +
            '<label class="field__label" for="aEmail">Email address ' +
              '<span class="field__req">*</span></label>' +
            '<input class="input" id="aEmail" type="email" autocomplete="email" ' +
              'value="' + esc(user.email) + '">' +
            '<div class="field__error" id="aEmailErr" hidden></div>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="aContact">Contact number</label>' +
            '<input class="input" id="aContact" type="tel" autocomplete="tel" ' +
              'value="' + esc(user.contact || '') + '">' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="aDept">Department / affiliation</label>' +
          '<input class="input" id="aDept" maxlength="80" value="' +
            esc(user.department || '') + '">' +
        '</div>' +
        '<div class="notice notice--muted mb-0">' +
          '<span class="notice__icon">' + App.Icons.get('lock', { size: 15 }) + '</span>' +
          '<div>Role, status and permissions are not shown here. A user must not ' +
          'be able to raise their own access.</div>' +
        '</div>',
      footer:
        '<button class="btn" data-act="cancel">Cancel</button>' +
        '<button class="btn btn--primary" data-act="save">Save changes</button>',
      onMount: function (root, handle) {
        App.Shell.hydrateIcons(root);
        var name = root.querySelector('#aName');
        var email = root.querySelector('#aEmail');

        root.querySelector('[data-act="cancel"]').addEventListener('click', handle.close);

        root.querySelector('[data-act="save"]').addEventListener('click', function () {
          var ok = true;
          hide('aNameErr', name); hide('aEmailErr', email);

          if (!name.value.trim()) {
            show('aNameErr', name, 'Full name is required.'); ok = false;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
            show('aEmailErr', email, 'Enter a valid email address.'); ok = false;
          }
          if (!ok) { (name.classList.contains('is-invalid') ? name : email).focus(); return; }

          App.Store.users.update(user.id, {
            fullName: name.value.trim(),
            email: email.value.trim(),
            contact: root.querySelector('#aContact').value.trim(),
            department: root.querySelector('#aDept').value.trim()
          });

          handle.close();
          App.Shell.toast('Your details were updated.', 'ok');
          render();
          /* the topbar chip shows the old name until the shell re-renders */
          setTimeout(function () { location.reload(); }, 700);
        });

        function show(errId, input, msg) {
          var el = root.querySelector('#' + errId);
          input.classList.add('is-invalid');
          el.hidden = false;
          el.innerHTML = App.Icons.get('alert', { size: 12 }) + esc(msg);
        }
        function hide(errId, input) {
          var el = root.querySelector('#' + errId);
          input.classList.remove('is-invalid');
          el.hidden = true;
        }
      }
    });
  }
})(window.App = window.App || {});
