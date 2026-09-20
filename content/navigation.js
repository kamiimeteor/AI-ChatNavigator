window.ACN_Navigation = (function () {
  var pending = null;

  function cancel() {
    if (pending) pending.finish({ status: 'cancelled' });
  }

  function navigate(adapter, entry) {
    cancel();
    return new Promise(function (resolve) {
      var url = location.href;
      var timer = null;
      var finished = false;
      var job = { finish: finish };
      pending = job;

      function finish(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (type) {
          document.removeEventListener(type, onInput, true);
        });
        if (pending === job) pending = null;
        resolve(result);
      }

      function onInput(event) {
        if (event.type === 'keydown' && !['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
        finish({ status: 'cancelled' });
      }

      function currentTarget() {
        if (finished || url !== location.href) return null;
        return window.ACN_MessageIndex.resolve(entry, adapter.getUserMessages());
      }

      function position(target) {
        var container = window.ACN_AdapterUtils.scroller(target);
        var root = container === document.scrollingElement || container === document.documentElement || container === document.body;
        var bounds = root ? { top: 0, bottom: window.innerHeight } : container.getBoundingClientRect();
        var rect = target.getBoundingClientRect();
        var offset = Math.min(80, (bounds.bottom - bounds.top) / 4);
        return { container: container, delta: rect.top - bounds.top - offset,
          visible: rect.top >= bounds.top + 8 && rect.top < bounds.bottom - 32 };
      }

      function scroll(target) {
        var pos = position(target);
        // Instant scrolls have no native animation left running after cancel.
        pos.container.scrollTo({ top: Math.max(0, pos.container.scrollTop + pos.delta), behavior: 'instant' });
      }

      try {
        var target = currentTarget();
        if (!target) { finish({ status: 'unavailable' }); return; }
        ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (type) {
          document.addEventListener(type, onInput, { capture: true, passive: true });
        });
        scroll(target);
        // One bounded correction for layout settling; never pin the user's
        // scroll position or load history implicitly.
        timer = setTimeout(function () {
          if (url !== location.href) { finish({ status: 'cancelled' }); return; }
          try {
            var fresh = currentTarget();
            if (!fresh) { finish({ status: 'unavailable' }); return; }
            if (!position(fresh).visible) scroll(fresh);
            finish({ status: 'success', element: fresh });
          } catch (error) {
            finish({ status: 'failed' });
          }
        }, 120);
      } catch (error) {
        finish({ status: 'failed' });
      }
    });
  }

  return { navigate: navigate, cancel: cancel };
})();
