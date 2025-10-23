/*! report-fab.js — injects a floating "Report" button that links to report-issue.html */
(function(){
  if (document.body.dataset.reportFabInjected === "1") return;
  document.body.dataset.reportFabInjected = "1";

  var isReportPage = /(^|\/)report-issue\.html(\?|$)/i.test(location.pathname);
  if (isReportPage) return;

  var btn = document.createElement('button');
  btn.className = 'report-fab';
  btn.type = 'button';
  btn.setAttribute('aria-label','Report an issue');
  btn.innerHTML = '<span aria-hidden="true">⚠</span><i class="label">Report</i>';

  btn.addEventListener('click', function(e){
    var t = document.title || 'Untitled';
    var u = location.href;
    var target = (window.REPORT_PAGE_PATH || 'report-issue.html')
      + '?from=' + encodeURIComponent(t)
      + '&url='  + encodeURIComponent(u);

    if (e.metaKey || e.ctrlKey){
      window.open(target, '_blank');
    } else {
      location.href = target;
    }
  });

  document.body.appendChild(btn);
})();