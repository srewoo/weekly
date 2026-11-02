// The Settings page: each section's module wires its own controls.
import '../components/theme.js';
import { mountNav } from '../components/nav.js';
import * as settings from './settings-panel.js';
import * as reminders from './reminder-settings.js';
import * as pin from './pin-settings.js';
import * as data from './data-panel.js';
import * as importPanel from './import-panel.js';
import * as history from './history-settings.js';
import * as sectionNav from './section-nav.js';

void mountNav('settings');
[settings, reminders, pin, data, importPanel, history, sectionNav].forEach((m) => m.init());
