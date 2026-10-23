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
    'games': ('GamesScreen', 'games', 'event'),
    'game-rules': ('GameRulesScreen', 'games', 'any'),
    'submit-points': ('SubmitPointsScreen', 'night', 'submit'),
    'attendance': ('AttendanceScreen', 'night', 'attendance'),
    'parent-link': ('ParentLinkScreen', 'night', 'board'),
    'recap': ('RecapScreen', 'recap', 'recap'),
    'media': ('MediaScreen', 'media', 'any'),
})
