# Routes added after the first batch: route -> (Component, module, gate)
EXTRA.update({
    'huddle': ('HuddleScreen', 'huddle', 'huddle'),
    'races': ('RacesScreen', 'races', 'member'),
    'follow-ups': ('FollowUpsScreen', 'follow-ups', 'member'),
    'bible': ('BibleScreen', 'bible', 'any'),
    'notifications': ('NotificationsScreen', 'oversight', 'any'),
    'settings': ('SettingsScreen', 'oversight', 'any'),
    'approvals': ('ApprovalsScreen', 'oversight', 'approve'),
    'access-requests': ('AccessRequestsScreen', 'oversight', 'approve'),
    'audit': ('AuditScreen', 'oversight', 'approve'),
})
