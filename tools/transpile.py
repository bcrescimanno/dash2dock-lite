#!/usr/bin/python

import sys
import re

from os import listdir, mkdir, makedirs
from os.path import isdir, isfile, join, exists
from shutil import copyfile, copytree, rmtree
from pprint import pprint

imports = []

def modifyMetadata():
    o = open("./build/metadata.json", "w")
    for l in open("./metadata.json", "r"):
        if '"45"' in l:
            l = '"42", "43", "44"\n'
        o.write(l)

importMap = [
    [ "import * as Main", "const Main = imports.ui.main;"],
    [ "import * as Fav", "const Fav = imports.ui.appFavorites;"],
    [ "import * as PopupMenu", "const PopupMenu = imports.ui.popupMenu;"],
    [ "import * as BoxPointer", "const BoxPointer = imports.ui.boxpointer;"],
    # [ "", "const Layout = imports.ui.layout;"],
    [ "import { BaseIcon } from", "const BaseIcon = imports.ui.iconGrid;"],
    [ "import { Dash } from", "const Dash = imports.ui.dash.Dash;" ],
    [ "import { ShowAppsIcon }", "const ShowAppsIcon = imports.ui.dash.ShowAppsIcon;" ],
    [ "import GLib", "const GLib = imports.gi.GLib;" ],
    [ "import Gio", "const Gio = imports.gi.Gio;" ],
    [ "import GObject", "const GObject = imports.gi.GObject;" ],
    [ "import Clutter", "const Clutter = imports.gi.Clutter;" ],
    [ "import Graphene", "const Graphene = imports.gi.Graphene;" ],
    [ "import St", "const St = imports.gi.St;" ],
    [ "import PangoCairo", "const PangoCairo = imports.gi.PangoCairo;" ],
    [ "import Pango", "const Pango = imports.gi.Pango;" ],
    [ "import Meta", "const Meta = imports.gi.Meta;" ],
    [ "import Shell", "const Shell = imports.gi.Shell;" ],
    [ "import Gtk", "const Gtk = imports.gi.Gtk;" ],
    [ "import Gdk", "const Gdk = imports.gi.Gdk;" ],
    [ "import Adw", "const Adw = imports.gi.Adw;" ],
    [ "import Cairo", "const Cairo = imports.cairo;" ],
    # [ "", "const Point = Graphene.Point;" ],
    [ "from './animator.js", "const Animator = Me.imports.animator.Animator;" ],
    [ "from './autohide.js", "const AutoHide = Me.imports.autohide.AutoHide;" ],
    [ "import { MonitorsConfig }", "const MonitorsConfig = Me.imports.monitors.MonitorsConfig;" ],
    [ "import { Timer }", "const Timer = Me.imports.timer.Timer;" ],
    [ "import { Style }", "const Style = Me.imports.style.Style;" ],
    [ "import { Dock }", "const Dock = Me.imports.dock.Dock;" ],
    [ "import { DockPosition }", "const DockPosition = {BOTTOM: 'bottom',LEFT: 'left',RIGHT: 'right',TOP: 'top'};" ],
    [ "import { Services }", "const Services = Me.imports.services.Services;" ],
    [ "import { runTests }", "const runTests = Me.imports.diagnostics.runTests;" ],
    [ "import { schemaId, SettingsKeys }", "const { schemaId, settingsKeys, SettingsKeys } = Me.imports.preferences.keys;" ],
    [ "import { Bounce, Linear }", "const { Bounce, Linear } = Me.imports.effects.easing;" ],
    [ "import { MonochromeEffect }", "const MonochromeEffect = Me.imports.effects.monochrome_effect.MonochromeEffect;" ],
    [ "import { TintEffect }", "const TintEffect = Me.imports.effects.tint_effect.TintEffect;" ],
    [ "import { Clock }", "const Clock = Me.imports.apps.clock.Clock;" ],
    [ "import { Calendar }", "const Calendar = Me.imports.apps.calendar.Calendar;" ],
    [ "import { Dot }", "const Dot = Me.imports.apps.dot.Dot;" ],
    [ "import { PrefKeys }", "let { PrefKeys } = Me.imports.preferences.prefKeys;" ],
    [ "import { getPointer, warpPointer }", "const { getPointer, warpPointer } = Me.imports.utils;" ],
    [ "from '../drawing.js'", "const Drawing = Me.imports.drawing.Drawing;" ],
    [ "from './dockItems.js'", "const { DockItemDotsOverlay, DockItemList, DockItemBadgeOverlay, DockItemContainer, DockBackground } = Me.imports.dockItems;" ],
    [ "import {ExtensionPreferences", "class ExtensionPreferences {}" ],
    [ "import {Extension", "class Extension {}" ],
    # [ "import { trySpawnCommandLine }", "const trySpawnCommandLine = () => {};" ],
    [ "import { trySpawnCommandLine }", "const { trySpawnCommandLine } = imports.misc.util;" ],
]

def dump(f):
    if not f.endswith(".js"):
        return
    if "build/" in f:
        return
    if "tests/" in f:
        return
    if "imports_" in f:
        return
    f = f.strip()
    of = f.replace("./", "./build/")
    
    output = open(of, "w")

    output.write("const ExtensionUtils = imports.misc.extensionUtils;\n")
    output.write("const Me = ExtensionUtils.getCurrentExtension();\n\n")

    inImport = False;
    importLine = ""
    for l in open(f, "r"):
        commentOut = False

        if "this.getSettings(schemaId)" in l:
            l = l.replace("this.getSettings", "ExtensionUtils.getSettings");

        if l.startswith("import ") and not inImport:
            # commentOut = True
            inImport = True

        if inImport:
            importLine = importLine + l.strip();

        if l.startswith("export default"):
            l = l.replace("export default", "")
        if l.startswith("export "):
            if "class {" in l:
                l = l.replace("const ", "var ")
                l = l.replace("let ", "var ")
            if "const schemaId" in l:
                l = l.replace("const schemaId", "var schemaId");
            if "registerClass" in l:
                l = l.replace("const ", "var ");
                l = l.replace("let ", "var ");
            if "= () => {" in l:
                l = l.replace("const ", "var ");
                l = l.replace("let ", "var ");
            if "= {" in l:
                l = l.replace("const ", "var ");
                l = l.replace("let ", "var ");
            l = l.replace("export ", "")

        if commentOut:
            output.write("//")

        if not inImport:
            output.write(l);

        if inImport and "from" in l:
            handled = False
            for m in importMap:
                if m[0] in importLine:
                    output.write(m[1])
                    output.write("\n")
                    handled = True
                    break

            if not handled:
                output.write(importLine)

            inImport = False
            importLine = ""

    if "prefs.js" in f:
        for l in open("./tools/imports_prefs.js", "r"):
            output.write(l)
    if "extension.js" in f:
        for l in open("./tools/imports_extension.js", "r"):
            output.write(l)

    output.write("\n\n")


def dumpFiles(path):
    morePaths = []

    files = listdir(path)
    for f in files:
        fullpath = join(path, f)

        if isdir(fullpath):
            morePaths.append(fullpath)
            continue

        dump(fullpath)

    for p in morePaths:
        dumpFiles(p)

dumpFiles("./")
modifyMetadata()
