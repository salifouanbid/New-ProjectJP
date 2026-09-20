import * as S from './shared.js';

export default {
  nav: [
    { key: 'dashboard', icon: '📊', fr: 'Tableau de bord', en: 'Dashboard' },
    { key: 'grades', icon: '📝', fr: 'Mes notes', en: 'My grades' },
    { key: 'attendance', icon: '🗓️', fr: 'Assiduité', en: 'Attendance' },
    { key: 'programme', icon: '📚', fr: 'Programme', en: 'Curriculum' },
    { key: 'archives', icon: '🗂️', fr: 'Archives', en: 'Archives' },
    { key: 'news', icon: '📣', fr: 'Actualités', en: 'News' },
  ],
  views: {
    dashboard: (root) => S.dashboardView(root, '/student'),
    grades: (root) => S.gradesView(root, '/student'),
    attendance: (root) => S.attendanceView(root, '/student', { canJustify: false }),
    programme: (root) => S.programmeView(root, '/student'),
    archives: (root) => S.archivesView(root, '/student'),
    news: (root) => S.newsView(root),
  },
};
