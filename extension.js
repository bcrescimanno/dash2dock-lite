/*
  License: GPL v3
*/

const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Layout = imports.ui.layout;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Point = imports.gi.Graphene.Point;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const schema_id = Me.imports.prefs.schema_id;
const SettingsKey = Me.imports.prefs.SettingsKey;
const Animator = Me.imports.animator.Animator;

const setTimeout = Me.imports.utils.setTimeout;
const setInterval = Me.imports.utils.setInterval;

class Extension {
  enable() {
    this.listeners = [];
    this.scale = 1.0;

    this._enableSettings();
    this._queryDisplay();

    this.dashContainer = new St.BoxLayout({
      name: 'dashContainer',
      vertical: true,
    });
    this.dashContainer.delegate = this;

    Main.layoutManager.addChrome(this.dashContainer, {
      affectsStruts: this.affectsStruts,
      trackFullscreen: true,
    });

    this.dash = Main.overview.dash;
    this.dashContainer.dash = this.dash;
    Main.uiGroup
      .find_child_by_name('overview')
      .first_child.remove_child(this.dash);
    this.dashContainer.add_child(this.dash);

    // this._updateAppsButton();
    // this._updateShrink();
    // this._updateBgDark();
    // this._updateBgOpacity();
    // this._updateLayout();
    // this._updateAnimation();
    // this._updateAutohide();

    this._addEvents();

    this.animator = new Animator();
    this.animator.dashContainer = this.dashContainer;
    this.animator.enable();

    this.listeners = [this.animator];

    this._updateLayout();
  }

  disable() {
    this._removeEvents();
    this._disableSettings();

    this.animator.disable();
    delete this.animator;
    this.animator = null;

    // this._updateAppsButton(true);
    // this._updateShrink(true);
    // this._updateBgDark(true);
    // this._updateBgOpacity(true);
    this._updateLayout(true);
    // this._updateAnimation(true);
    // this._updateAutohide(true);

    this.dashContainer.remove_child(this.dash);
    Main.uiGroup
      .find_child_by_name('overview')
      .first_child.add_child(this.dash);

    Main.layoutManager.removeChrome(this.dashContainer);
    this.dashContainer.destroy();

    this.dashContainer = null;
  }

  _queryDisplay() {
    this.monitor = Main.layoutManager.primaryMonitor;
    this.sw = this.monitor.width;
    this.sh = this.monitor.height;
  }

  _enableSettings() {
    this._settings = ExtensionUtils.getSettings(schema_id);
    this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
    this.animateIcons = this._settings.get_boolean(SettingsKey.ANIMATE_ICONS);
    this.bgDark = this._settings.get_boolean(SettingsKey.BG_DARK);
    this.bgOpacity = this._settings.get_double(SettingsKey.BG_OPACITY);
    this.recycleOldDash = this._settings.get_boolean(SettingsKey.REUSE_DASH);
    this.hideAppsButton = true;
    this.vertical = false;
    this.autohide = true;
    this.autohide = this._settings.get_boolean(SettingsKey.AUTOHIDE_DASH);
    this.affectsStruts = !this.autohide;

    this._settingsListeners = [];

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.REUSE_DASH}`, () => {
        this.recycleOldDash = this._settings.get_boolean(
          SettingsKey.REUSE_DASH
        );
        this.disable();
        this.enable();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.BG_DARK}`, () => {
        this.bgDark = this._settings.get_boolean(SettingsKey.BG_DARK);
        this._updateBgDark();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.BG_OPACITY}`, () => {
        this.bgOpacity = this._settings.get_double(SettingsKey.BG_OPACITY);
        this._updateBgOpacity();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.SHRINK_ICONS}`, () => {
        this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
        this._updateShrink();
        this._updateLayout();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.ANIMATE_ICONS}`, () => {
        this.animateIcons = this._settings.get_boolean(
          SettingsKey.ANIMATE_ICONS
        );
        this._updateAnimation();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.AUTOHIDE_DASH}`, () => {
        this.autohide = this._settings.get_boolean(SettingsKey.AUTOHIDE_DASH);
        this.disable();
        this.enable();
      })
    );
  }

  _disableSettings() {
    this._settingsListeners.forEach((id) => {
      this._settings.disconnect(id);
    });
    this._settingsListeners = [];
    this._settings = null;
  }

  _addEvents() {
    this.dashContainer.set_reactive(true);
    this.dashContainer.set_track_hover(true);

    this._dashContainerEvents = [];
    this._dashContainerEvents.push(
      this.dashContainer.connect('motion-event', this._onMotionEvent.bind(this))
    );
    this._dashContainerEvents.push(
      this.dashContainer.connect('enter-event', this._onEnterEvent.bind(this))
    );
    this._dashContainerEvents.push(
      this.dashContainer.connect('leave-event', this._onLeaveEvent.bind(this))
    );
    this._dashContainerEvents.push(
      this.dashContainer.connect('destroy', () => {})
    );

    this._layoutManagerEvents = [];
    this._layoutManagerEvents.push(
      Main.layoutManager.connect('startup-complete', () => {
        log('startup-complete');
        this._updateLayout();
      })
    );

    this._displayEvents = [];
    this._displayEvents.push(
      global.display.connect(
        'notify::focus-window',
        this._onFocusWindow.bind(this)
      )
    );
    this._displayEvents.push(
      global.display.connect(
        'in-fullscreen-changed',
        this._onFullScreen.bind(this)
      )
    );

    this._overViewEvents = [];
    this._overViewEvents.push(
      Main.overview.connect('showing', this._onOverviewShowing.bind(this))
    );
    this._overViewEvents.push(
      Main.overview.connect('hidden', this._onOverviewHidden.bind(this))
    );
  }

  _removeEvents() {
    this.dashContainer.set_reactive(false);
    this.dashContainer.set_track_hover(false);

    this._dashContainerEvents.forEach((id) => {
      if (this.dashContainer) {
        this.dashContainer.disconnect(id);
      }
    });
    this._dashContainerEvents = [];

    if (this._overViewEvents) {
      this._overViewEvents.forEach((id) => {
        Main.overview.disconnect(id);
      });
    }
    this._overViewEvents = [];

    if (this._layoutManagerEvents) {
      this._layoutManagerEvents.forEach((id) => {
        Main.layoutManager.disconnect(id);
      });
    }
    this._layoutManagerEvents = [];

    if (this._displayEvents) {
      this._displayEvents.forEach((id) => {
        global.display.disconnect(id);
      });
    }
    this._displayEvents = [];
  }

  _onMotionEvent() {
    this.listeners.forEach((l) => {
      l._onMotionEvent();
    });
  }

  _onEnterEvent() {
    this._updateLayout();
    this.listeners.forEach((l) => {
      l._onEnterEvent();
    });
  }

  _onLeaveEvent() {
    this.listeners.forEach((l) => {
      l._onLeaveEvent();
    });
  }

  _onFocusWindow() {
    this.listeners.forEach((l) => {
      l._onFocusWindow();
    });
  }

  _onFullScreen() {
    this.listeners.forEach((l) => {
      l._onFullScreen();
    });
  }

  _updateAppsButton(disable) {}

  _updateShrink(disable) {
    if (!this.dashContainer) return;
    if (this.shrink && !disable) {
      this.dashContainer.add_style_class_name('shrink');
    } else {
      this.dashContainer.remove_style_class_name('shrink');
    }
  }

  _updateBgDark(disable) {
    if (!this.dashContainer) return;

    if (this.bgDark && !disable) {
      this.dashContainer.add_style_class_name('dark');
    } else {
      this.dashContainer.remove_style_class_name('dark');
    }
  }

  _updateBgOpacity(disable) {
    if (!this.dash) return;

    if (disable) {
      this.dash.first_child.opacity = 255;
    } else {
      this.dash.first_child.opacity = 255 * this.bgOpacity;
    }
  }

  _findIcons() {
    if (!this.dash) return [];

    let icons = this.dash._box.get_children().filter((actor) => {
      return (
        actor.child &&
        actor.child._delegate &&
        actor.child._delegate.icon &&
        !actor.animatingOut
      );
    });

    // if (this.dash._showAppsIcon) {
    //   icons.push(this.dash._showAppsIcon);
    // }

    icons.forEach((c) => {
      let label = c.label;
      let appwell = c.first_child;
      let draggable = appwell._draggable;
      let widget = appwell.first_child;
      let icongrid = widget.first_child;
      let boxlayout = icongrid.first_child;
      let bin = boxlayout.first_child;
      let icon = bin.first_child;
      c._bin = bin;
      c._label = label;
      c._icon = icon;
    });

    this.dashContainer._icons = icons;
    return icons;
  }

  _updateLayout(disable) {
    if (disable || !this.dashContainer) return;

    this._queryDisplay();

    let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    let iconSize = 64; // << todo

    let scale = this.scale;
    let dockHeight = iconSize * 2 * scale;

    this.dashContainer.set_size(this.sw, dockHeight);
    this.dashContainer.set_position(
      this.monitor.x,
      this.monitor.y + this.sh - dockHeight - iconSize * (1 - scale)
    );

    let iconChildren = this._findIcons();

    for (let i = 0; i < iconChildren.length; i++) {
      let icon = iconChildren[i].child._delegate.icon;
      if (!icon._setIconSize) {
        icon._setIconSize = icon.setIconSize;
      }

      icon._scale = scale;
      icon.setIconSize = ((sz) => {
        sz *= icon._scale;
        icon._setIconSize(sz);
      }).bind(icon);
    }

    this.dash._maxWidth = this.sw;
    this.dash._maxHeight = this.sh;
    this.dash.iconSize--;
    this.dash._adjustIconSize();
  }

  _updateAnimation(disable) {
    if (!disable) {
      this.animator.enable();
    } else {
      this.animator.disable();
    }
  }

  _updateAutohide(disable) {}

  _onOverviewShowing() {
    this._inOverview = true;

    this.dashContainer.remove_child(this.dash);
    Main.uiGroup
      .find_child_by_name('overview')
      .first_child.add_child(this.dash);
    this.dashContainer.hide();

    log('_onOverviewShowing');
  }

  _onOverviewHidden() {
    this._inOverview = false;

    Main.uiGroup
      .find_child_by_name('overview')
      .first_child.remove_child(this.dash);
    this.dashContainer.add_child(this.dash);
    this.dashContainer.show();

    this._updateLayout();

    log('_onOverviewHidden');
  }
}

function init() {
  return new Extension();
}
