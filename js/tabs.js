(function () {
  "use strict";
  var NAMES = ["infografia", "calendario", "guia"];

  function show(name) {
    if (NAMES.indexOf(name) === -1) return;
    NAMES.forEach(function (n) {
      var btn = document.getElementById("tab-btn-" + n);
      var panel = document.getElementById("tab-" + n);
      var active = n === name;
      if (btn) {
        btn.setAttribute("aria-selected", active ? "true" : "false");
        btn.tabIndex = active ? 0 : -1;
      }
      if (panel) panel.hidden = !active;
    });
    document.dispatchEvent(new CustomEvent("rx:tab", { detail: { name: name } }));
  }

  function init() {
    var nav = document.getElementById("tabs");
    if (!nav) return;
    var buttons = Array.prototype.slice.call(nav.querySelectorAll('[role="tab"]'));
    buttons.forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        show(btn.id.replace("tab-btn-", ""));
      });
      btn.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var next = buttons[(i + d + buttons.length) % buttons.length];
        next.focus();
        show(next.id.replace("tab-btn-", ""));
      });
    });
    show("infografia");
  }

  window.RxTabs = { show: show };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
