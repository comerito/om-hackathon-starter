# staff — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| staff:staff_team | StaffTeam | staff_teams | yes | no |
| staff:staff_team_role | StaffTeamRole | staff_team_roles | yes | no |
| staff:staff_team_member | StaffTeamMember | staff_team_members | yes | no |
| staff:staff_leave_request | StaffLeaveRequest | staff_leave_requests | yes | no |
| staff:staff_team_member_comment | StaffTeamMemberComment | staff_team_member_comments | yes | no |
| staff:staff_team_member_activity | StaffTeamMemberActivity | staff_team_member_activities | yes | no |
| staff:staff_team_member_job_history | StaffTeamMemberJobHistory | staff_team_member_job_histories | yes | no |
| staff:staff_team_member_address | StaffTeamMemberAddress | staff_team_member_addresses | yes | no |
| staff:staff_time_entry | StaffTimeEntry | staff_time_entries | yes | no |
| staff:staff_time_entry_segment | StaffTimeEntrySegment | staff_time_entry_segments | yes | no |
| staff:staff_time_project | StaffTimeProject | staff_time_projects | yes | no |
| staff:staff_time_project_member | StaffTimeProjectMember | staff_time_project_members | yes | no |

## Events  (35)

| ID | Category | Entity |
|---|---|---|
| staff.team.created | crud | team |
| staff.team.updated | crud | team |
| staff.team.deleted | crud | team |
| staff.team_role.created | crud | team_role |
| staff.team_role.updated | crud | team_role |
| staff.team_role.deleted | crud | team_role |
| staff.team_member.created | crud | team_member |
| staff.team_member.updated | crud | team_member |
| staff.team_member.deleted | crud | team_member |
| staff.leave_request.created | crud | leave_request |
| staff.leave_request.updated | crud | leave_request |
| staff.leave_request.deleted | crud | leave_request |
| staff.address.created | crud | address |
| staff.address.updated | crud | address |
| staff.address.deleted | crud | address |
| staff.comment.created | crud | comment |
| staff.comment.updated | crud | comment |
| staff.comment.deleted | crud | comment |
| staff.activity.created | crud | activity |
| staff.activity.updated | crud | activity |
| staff.activity.deleted | crud | activity |
| staff.job_history.created | crud | job_history |
| staff.job_history.updated | crud | job_history |
| staff.job_history.deleted | crud | job_history |
| staff.timesheets.time_entry.created | crud | time_entry |
| staff.timesheets.time_entry.updated | crud | time_entry |
| staff.timesheets.time_entry.deleted | crud | time_entry |
| staff.timesheets.time_entry.timer_started | lifecycle | time_entry |
| staff.timesheets.time_entry.timer_stopped | lifecycle | time_entry |
| staff.timesheets.time_project.created | crud | time_project |
| staff.timesheets.time_project.updated | crud | time_project |
| staff.timesheets.time_project.deleted | crud | time_project |
| staff.timesheets.time_project_member.created | crud | time_project_member |
| staff.timesheets.time_project_member.updated | crud | time_project_member |
| staff.timesheets.time_project_member.deleted | crud | time_project_member |

## ACL features  (16)

staff.view · staff.manage_team · staff.leave_requests.send · staff.leave_requests.manage · staff.my_availability.view · staff.my_availability.manage · staff.my_availability.unavailability · staff.my_leave_requests.view · staff.my_leave_requests.send · staff.timesheets.view · staff.timesheets.manage_own · staff.timesheets.manage_all · staff.timesheets.projects.view · staff.timesheets.projects.manage · staff.timesheets.approve · staff.timesheets.lock

## API routes

_none_

## DI service tokens

_none_

## Search entities

staff:staff_team · staff:staff_team_member · staff:staff_team_role · staff:staff_time_project

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

staff.leave_request.pending · staff.leave_request.approved · staff.leave_request.rejected

## CLI

seed-activity-types · seed-address-types · seed-examples · seed-timesheets-widgets
