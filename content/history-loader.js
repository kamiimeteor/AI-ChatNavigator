window.ACN_HistoryLoader = (function () {
  var current = null;
  var inputTypes = ['wheel', 'touchstart', 'pointerdown', 'keydown'];

  function cancel() {
    if (current) current.cancel();
  }

  function start(adapter, onUpdate, onState, delay) {
    cancel();
    if (!adapter.getHistorySnapshot) return;
    var url = location.href;
    var timer = null;
    var finished = false;
    var baseline = null;
    var scroller = null;
    var anchor = null;
    var anchorOffset = 0;
    var originalTop = 0;
    var deadline = 0;
    var attempted = new Set();
    var job = { cancel: function () { finish('cancelled'); } };
    current = job;

    function finish(state) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      inputTypes.forEach(function (type) { document.removeEventListener(type, onInput, true); });
      document.removeEventListener('visibilitychange', onVisibility);
      if (current === job) current = null;
      onState(state);
    }

    function onInput(event) {
      if ((event.type === 'pointerdown' || event.type === 'keydown') && event.target &&
          event.target.closest && event.target.closest('[data-acn-history-stop]')) return;
      // The user owns scrolling from this point. Never restore over their input.
      finish('cancelled');
    }

    function onVisibility() {
      if (document.hidden) finish('cancelled');
    }

    function snapshot() {
      if (finished || location.href !== url || document.hidden) return null;
      var next = adapter.getHistorySnapshot();
      if (!next.root || !next.root.isConnected) return null;
      if (baseline) {
        if (next.root !== baseline.root || !scroller.isConnected) return null;
        // Appended turns are safe; removal, reordering or ID reuse invalidates
        // both the scan and the saved reading anchor (e.g. branch switches).
        var cursor = 0;
        for (var i = 0; i < next.turns.length && cursor < baseline.turns.length; i++) {
          var expected = baseline.turns[cursor];
          if (next.turns[i].element === expected.element && next.turns[i].id === expected.id) cursor++;
        }
        if (cursor !== baseline.turns.length) return null;
      }
      return next;
    }

    function topEdge() {
      return scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body
        ? 0 : scroller.getBoundingClientRect().top;
    }

    function later(fn, ms) {
      timer = setTimeout(function () {
        if (finished) return;
        try { fn(); } catch (error) { finish('partial'); }
      }, ms);
    }

    function restore(state) {
      if (!snapshot()) { finish('cancelled'); return; }
      function position() {
        var top = anchor && anchor.isConnected
          ? scroller.scrollTop + anchor.getBoundingClientRect().top - topEdge() - anchorOffset
          : originalTop;
        scroller.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      }
      position();
      // Restoring can remount the original turn and adjust preceding heights.
      // One bounded correction, with user input still able to cancel it.
      later(function () {
        if (!snapshot()) { finish('cancelled'); return; }
        position();
        onUpdate();
        finish(state);
      }, 120);
    }

    function step() {
      var next = snapshot();
      if (!next) { finish('cancelled'); return; }
      onUpdate();
      if (!next.pending.length) { restore('complete'); return; }
      var target = next.pending.find(function (element) { return !attempted.has(element); });
      if (!target || attempted.size >= 150 || Date.now() >= deadline) { restore('partial'); return; }
      attempted.add(target);
      scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + target.getBoundingClientRect().top - topEdge() - 80), behavior: 'instant' });
      var checks = 0;
      function waitForTurn() {
        var mounted = snapshot();
        if (!mounted) { finish('cancelled'); return; }
        onUpdate();
        if (mounted.pending.includes(target) && ++checks < 20 && Date.now() < deadline) {
          later(waitForTurn, 50);
        } else {
          later(step, 0);
        }
      }
      later(waitForTurn, 50);
    }

    inputTypes.forEach(function (type) {
      document.addEventListener(type, onInput, { capture: true, passive: true });
    });
    document.addEventListener('visibilitychange', onVisibility);
    onState('scheduled');
    later(function () {
      var initial = snapshot();
      if (!initial || !initial.turns.length) { finish('cancelled'); return; }
      if (!initial.pending.length) { finish('complete'); return; }
      baseline = initial;
      scroller = window.ACN_AdapterUtils.scroller(initial.turns[0].element);
      originalTop = scroller.scrollTop;
      var edge = topEdge();
      anchor = initial.turns[0].element;
      initial.turns.forEach(function (turn) {
        if (turn.element.getBoundingClientRect().top <= edge + 80) anchor = turn.element;
      });
      anchorOffset = anchor.getBoundingClientRect().top - edge;
      deadline = Date.now() + 15000;
      onState('loading');
      step();
    }, delay === undefined ? 600 : delay);
  }

  return { start: start, cancel: cancel };
})();
