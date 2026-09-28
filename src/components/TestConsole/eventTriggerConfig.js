import { Bell, Clock, Grid3x3, Home, Lock, Menu, Square } from "lucide-react";

/**
 * Button layout for the Event Triggers panel.
 * A button with `payload` is fired inline; without one, the payload comes
 * from eventDefinitions.js.
 */
export const EVENT_TRIGGER_SECTIONS = [
  {
    id: "lifecycle",
    title: "Iframe Lifecycle",
    icon: Clock,
    buttons: [
      {
        label: "Init + Verify",
        hint: "Full bootstrap flow",
        variant: "primary",
        event: "embedded::iframe.ready",
      },
      {
        label: "Ready",
        hint: "Signal app ready",
        variant: "success",
        event: "embedded::ready",
      },
      {
        label: "Destroy",
        hint: "destroy",
        variant: "danger",
        event: "embedded::destroy",
      },
    ],
  },
  {
    id: "auth",
    title: "Authentication",
    icon: Lock,
    buttons: [
      {
        label: "Refresh",
        hint: "auth.refresh",
        variant: "warning",
        event: "embedded::auth.refresh",
      },
      {
        label: "⚡ Introspect (Async)",
        hint: "auth.introspect → Promise",
        variant: "accent",
        event: "embedded::auth.introspect",
      },
    ],
  },
  {
    id: "page",
    title: "Page Navigation",
    icon: Home,
    buttons: [
      {
        label: "Navigate",
        hint: "page.navigate",
        event: "embedded::page.navigate",
      },
      {
        label: "Redirect",
        hint: "page.redirect",
        event: "embedded::page.redirect",
      },
      {
        label: "Set Title",
        hint: "page.setTitle",
        event: "embedded::page.setTitle",
      },
    ],
  },
  {
    id: "nav",
    title: "Navigation Bar",
    icon: Menu,
    buttons: [
      {
        label: "Set Action",
        hint: "nav.setAction",
        event: "embedded::nav.setAction",
      },
      {
        label: "Clear Action",
        hint: "nav.clearAction",
        event: "embedded::nav.clearAction",
      },
      {
        label: "Add item",
        hint: "nav.addNavItem (async)",
        event: "embedded::nav.addItem",
      },
      {
        label: "Update item",
        hint: "nav.updateNavItem",
        event: "embedded::nav.updateItem",
      },
      {
        label: "Remove item",
        hint: "nav.removeNavItem",
        event: "embedded::nav.removeItem",
      },
    ],
  },
  {
    id: "ui",
    title: "UI State",
    icon: Grid3x3,
    buttons: [
      {
        label: "Loading On",
        hint: "ui.loading (show)",
        event: "embedded::ui.loading",
        payload: { action: "show" },
      },
      {
        label: "Loading Off",
        hint: "ui.loading (hide)",
        event: "embedded::ui.loading",
        payload: { action: "hide" },
      },
      {
        label: "Breadcrumbs Show",
        hint: "ui.breadcrumbs (show)",
        event: "embedded::ui.breadcrumbs",
        payload: { action: "show" },
      },
      {
        label: "Breadcrumbs Hide",
        hint: "ui.breadcrumbs (hide)",
        event: "embedded::ui.breadcrumbs",
        payload: { action: "hide" },
      },
    ],
  },
  {
    id: "toast",
    title: "Toast Notifications",
    icon: Bell,
    buttons: [
      {
        label: "Success",
        hint: "ui.toast (success)",
        variant: "success",
        event: "embedded::ui.toast",
        payload: {
          type: "success",
          message: "Operation completed successfully!",
          duration: 3000,
        },
      },
      {
        label: "Error",
        hint: "ui.toast (error)",
        variant: "danger",
        event: "embedded::ui.toast",
        payload: {
          type: "error",
          message: "Something went wrong!",
          duration: 5000,
        },
      },
      {
        label: "Warning",
        hint: "ui.toast (warning)",
        variant: "warning",
        event: "embedded::ui.toast",
        payload: {
          type: "warning",
          message: "Please review your input",
          duration: 4000,
        },
      },
      {
        label: "Info",
        hint: "ui.toast (info)",
        variant: "info",
        event: "embedded::ui.toast",
        payload: {
          type: "info",
          message: "New features available",
          duration: 3000,
        },
      },
    ],
  },
  {
    id: "dialogs",
    title: "Dialogs",
    icon: Square,
    buttons: [
      {
        label: "⚡ Confirm (Async)",
        hint: "ui.confirm → Promise",
        variant: "accent",
        event: "embedded::ui.confirm",
      },
    ],
  },
];
