#!/usr/bin/env python3
"""Generate the thin app/dashboard/<route>/page.tsx wrappers.

Every page follows the same shape: a server component that resolves the
membership and redirects on a failed role check (requireGate), then renders
the client screen inside the matching client <Gate>, so a deep link and the
menu check the same named gate. Run from the repo root after adding a route.
"""
import os

ROUTES = {
    # route: (Component, module, gate)
    'score': ('ScoreScreen', 'score', 'score'),
    'more': ('MoreScreen', 'more', 'any'),
    'coach-view': ('CoachViewScreen', 'coach-view', 'coachView'),
    'team': ('TeamViewScreen', 'role-views', 'teamView'),
    'captain-view': ('CaptainViewScreen', 'role-views', 'captainView'),
    'admin-view': ('AdminViewScreen', 'role-views', 'adminView'),
    'parent-view': ('ParentViewScreen', 'role-views', 'parentView'),
    'congregation-view': ('CongregationViewScreen', 'role-views', 'congregationView'),
}

EXTRA = {}
if os.path.exists('scripts/routes-extra.py'):
    exec(open('scripts/routes-extra.py').read(), {'EXTRA': EXTRA})
ROUTES.update(EXTRA)

for route, (comp, mod, gate) in ROUTES.items():
    d = f'app/dashboard/{route}'
    os.makedirs(d, exist_ok=True)
    with open(f'{d}/page.tsx', 'w') as f:
        f.write(f"""import {{ Suspense }} from 'react';
import {{ Gate }} from '@/components/gate';
import {{ {comp} }} from '@/components/screens/{mod}';
import {{ GATES }} from '@/lib/gates';
import {{ requireGate }} from '@/lib/get-membership';

export default async function Page() {{
  await requireGate(GATES.{gate});
  return (
    <Gate allow="{gate}">
      <Suspense>
        <{comp} />
      </Suspense>
    </Gate>
  );
}}
""")
print(len(ROUTES), 'routes written')
