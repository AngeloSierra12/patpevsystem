/* ============================================================================
 * rbac.js — Role-Based Access Control
 * ----------------------------------------------------------------------------
 * WBS 2.3  |  OWNER: Angelo Andrei P. Sierra
 *
 * Single source of truth for "who is allowed to do what". Nothing in the UI
 * decides access on its own — every gate calls App.RBAC.can().
 *
 * Model
 *   role        -> a named bundle of permissions (admin / staff / guest)
 *   grants[]    -> per-user permissions added ON TOP of the role
 *   revokes[]   -> per-user permissions taken AWAY from the role
 *
 * Resolution order (most specific wins):
 *   1. account not 'active'            -> deny everything except session.end
 *   2. permission in user.revokes      -> DENY
 *   3. permission in user.grants       -> ALLOW
 *   4. permission in role bundle       -> ALLOW
 *   5. otherwise                       -> DENY   (deny-by-default)
 *
 * NOTE: this is authorisation only. Authentication (password hashing, login
 * verification, sessions) is WBS 2.2 and is NOT owned by this developer —
 * see core/session.js for the stub that stands in for it.
 * ========================================================================== */
(function (App) {
  'use strict';

  /* --- The permission catalogue ------------------------------------------- *
   * Grouped by module so the User Management screen can render it as a
   * checklist. `owner` marks which WBS module the permission belongs to.    */
  var CATALOG = [
    { group: 'Dashboard', items: [
      { key: 'dashboard.view',        label: 'View dashboard' },
      { key: 'dashboard.metrics.all', label: 'See hostel + canteen metrics' },
      { key: 'dashboard.actions',     label: 'Use quick actions panel' }
    ]},
    { group: 'Scheduling & Calendar', items: [
      { key: 'calendar.view',      label: 'View calendar' },
      { key: 'calendar.view.all',  label: 'See all bookings (not just own)' },
      { key: 'calendar.create',    label: 'Add schedule entries' },
      { key: 'calendar.edit',      label: 'Edit schedule entries' },
      { key: 'calendar.delete',    label: 'Delete schedule entries' },
      { key: 'calendar.override',  label: 'Override conflict warnings' }
    ]},
    { group: 'User Management', items: [
      { key: 'users.view',        label: 'View user accounts' },
      { key: 'users.create',      label: 'Create user accounts' },
      { key: 'users.edit',        label: 'Edit user information' },
      { key: 'users.delete',      label: 'Deactivate / delete accounts' },
      { key: 'users.role.assign', label: 'Assign roles' },
      { key: 'users.perm.manage', label: 'Manage individual permissions' },
      { key: 'account.self.edit', label: 'Edit own profile' }
    ]},
    { group: 'Hotel Reservation', items: [
      { key: 'reservations.view',     label: 'View reservations' },
      { key: 'reservations.view.own', label: 'View own reservations' },
      { key: 'reservations.manage',   label: 'Create / modify reservations' },
      { key: 'reservations.checkin',  label: 'Process check-in / check-out' },
      { key: 'billing.manage',        label: 'Record payments and billing' }
    ]},
    { group: 'Inventory', items: [
      { key: 'inventory.view',   label: 'View stock levels' },
      { key: 'inventory.manage', label: 'Add / issue / adjust stock' },
      { key: 'suppliers.manage', label: 'Manage suppliers and deliveries' }
    ]},
    { group: 'Reports & Audit', items: [
      { key: 'reports.view',     label: 'View and export reports' },
      { key: 'audit.view',       label: 'View audit trail' }
    ]}
  ];

  /* flat list of every valid permission key */
  var ALL = [];
  CATALOG.forEach(function (g) {
    g.items.forEach(function (i) { ALL.push(i.key); });
  });

  /* --- Role definitions ---------------------------------------------------- */
  var ROLES = {
    admin: {
      label: 'Administrator',
      description: 'Full system control. Manages accounts, roles and permissions, ' +
                   'and sees every module.',
      permissions: ALL.slice()          // admin holds the whole catalogue
    },

    staff: {
      label: 'Staff',
      description: 'Hostel and canteen personnel. Runs day-to-day operations ' +
                   'but cannot manage accounts or view the audit trail.',
      permissions: [
        'dashboard.view', 'dashboard.metrics.all', 'dashboard.actions',
        'calendar.view', 'calendar.view.all', 'calendar.create', 'calendar.edit',
        'users.view',
        'reservations.view', 'reservations.view.own', 'reservations.manage',
        'reservations.checkin', 'billing.manage',
        'inventory.view', 'inventory.manage', 'suppliers.manage',
        'account.self.edit'
      ]
    },

    guest: {
      label: 'Guest',
      description: 'External hostel guest. Sees only their own bookings and ' +
                   'room availability.',
      permissions: [
        'dashboard.view',
        'calendar.view',
        'reservations.view.own',
        'account.self.edit'
      ]
    }
  };

  var ROLE_ORDER = ['admin', 'staff', 'guest'];

  /* --- Core check ---------------------------------------------------------- */

  /**
   * Does `user` hold `permission`?
   * @param {object|null} user  a user record (see mock-data.js)
   * @param {string} permission a key from the catalogue
   * @returns {boolean}
   */
  function can(user, permission) {
    if (!user) return false;
    if (user.status !== 'active') return false;   // rule 1: inactive/suspended

    var role = ROLES[user.role];
    if (!role) return false;

    if ((user.revokes || []).indexOf(permission) !== -1) return false;  // rule 2
    if ((user.grants  || []).indexOf(permission) !== -1) return true;   // rule 3
    return role.permissions.indexOf(permission) !== -1;                 // rule 4/5
  }

  /** True if the user holds AT LEAST ONE of the given permissions. */
  function canAny(user, permissions) {
    return permissions.some(function (p) { return can(user, p); });
  }

  /** True if the user holds ALL of the given permissions. */
  function canAll(user, permissions) {
    return permissions.every(function (p) { return can(user, p); });
  }

  /** Every permission the user effectively holds, after grants and revokes. */
  function effective(user) {
    if (!user) return [];
    return ALL.filter(function (p) { return can(user, p); });
  }

  /**
   * Why does a user hold (or not hold) a permission? Used by the User
   * Management screen so an admin can see the reasoning, not just a checkbox.
   * @returns {{allowed:boolean, source:string, reason:string}}
   */
  function explain(user, permission) {
    if (!user) {
      return { allowed: false, source: 'none', reason: 'No user in session.' };
    }
    if (user.status !== 'active') {
      return { allowed: false, source: 'status',
               reason: 'Account is ' + user.status + ', so all access is blocked.' };
    }
    if ((user.revokes || []).indexOf(permission) !== -1) {
      return { allowed: false, source: 'revoke',
               reason: 'Revoked for this user specifically, overriding the role.' };
    }
    if ((user.grants || []).indexOf(permission) !== -1) {
      return { allowed: true, source: 'grant',
               reason: 'Granted to this user specifically, on top of the role.' };
    }
    var role = ROLES[user.role];
    if (role && role.permissions.indexOf(permission) !== -1) {
      return { allowed: true, source: 'role',
               reason: 'Included in the ' + role.label + ' role.' };
    }
    return { allowed: false, source: 'default',
             reason: 'Not in the ' + (role ? role.label : 'assigned') +
                     ' role, and not granted individually (deny by default).' };
  }

  /* --- DOM gating ---------------------------------------------------------- *
   * Any element can declare its own requirement in markup:
   *
   *   <button data-perm="users.create">Add user</button>
   *   <a data-perm="audit.view" data-perm-mode="disable">Audit trail</a>
   *
   * mode "hide"    (default) — element is removed from the page entirely
   * mode "disable"           — element stays visible but is inert and dimmed
   */
  function applyTo(root, user) {
    root = root || document;
    var nodes = root.querySelectorAll('[data-perm]');

    Array.prototype.forEach.call(nodes, function (el) {
      var required = el.getAttribute('data-perm').split(/\s+/).filter(Boolean);
      var mode = el.getAttribute('data-perm-mode') || 'hide';
      var ok = el.hasAttribute('data-perm-any')
        ? canAny(user, required)
        : canAll(user, required);

      if (ok) {
        el.hidden = false;
        el.classList.remove('is-perm-locked');
        el.removeAttribute('aria-disabled');
        el.removeAttribute('title');
        return;
      }

      if (mode === 'disable') {
        el.hidden = false;
        el.classList.add('is-perm-locked');
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('title', 'Your role does not allow this action.');
      } else {
        el.hidden = true;
      }
    });
  }

  /* --- Page-level guard ---------------------------------------------------- *
   * Called at the top of each page. If the signed-in user may not be here,
   * the page body is replaced with an access-denied notice instead of
   * rendering anything sensitive.                                            */
  function guard(user, permission, pageLabel) {
    if (can(user, permission)) return true;

    var main = document.querySelector('.page-body') || document.body;
    main.innerHTML =
      '<div class="denied">' +
        '<div class="denied__icon">' + App.Icons.get('lock', { size: 26 }) + '</div>' +
        '<h2 class="denied__title">Access restricted</h2>' +
        '<p class="denied__text">Your account is signed in as <strong>' +
          (user ? escapeHtml(roleLabel(user.role)) : 'no role') +
        '</strong>, which does not include permission to open ' +
        '<strong>' + escapeHtml(pageLabel || 'this page') + '</strong>.</p>' +
        '<p class="denied__meta">Required permission: <code>' +
          escapeHtml(permission) + '</code></p>' +
        '<p class="denied__text">Contact an administrator if you believe this ' +
        'is a mistake, or switch roles using the role selector in the header ' +
        'to preview a different level of access.</p>' +
        '<a class="btn btn--primary" href="' + App.Paths.to('index.html') +
        '">Back to dashboard</a>' +
      '</div>';
    return false;
  }

  function roleLabel(role) {
    return ROLES[role] ? ROLES[role].label : role;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  App.RBAC = {
    CATALOG: CATALOG,
    ALL: ALL,
    ROLES: ROLES,
    ROLE_ORDER: ROLE_ORDER,
    can: can,
    canAny: canAny,
    canAll: canAll,
    effective: effective,
    explain: explain,
    applyTo: applyTo,
    guard: guard,
    roleLabel: roleLabel
  };
})(window.App = window.App || {});
