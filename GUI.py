import wx
import json

class LobbyPanel(wx.Panel):
    def __init__(self, parent):
        super(LobbyPanel, self).__init__(parent)
        lobby_text = wx.StaticText(self, label="Find and join a lobby", pos=(10, 10))

class SettingsPanel(wx.ScrolledWindow):
    def __init__(self, parent):
        super(SettingsPanel, self).__init__(parent, style=wx.VSCROLL)

        self.sizer = wx.BoxSizer(wx.VERTICAL)

        settings_text = wx.StaticText(self, label="Update your settings:")
        self.sizer.Add(settings_text, 0, wx.ALL | wx.EXPAND, 5)

        # Define a list of keys you are interested in
        keys_of_interest = ["username", "ability1", "ability2", "ability3", "ability4", "ability5", "ability6"]

        # Load settings from JSON file and filter out specific keys
        json_data = self.load_settings("player.json", keys_of_interest)
        self.data = json_data[0]
        self.settings_data = json_data[1]

        # Handle "username" separately
        username_label = wx.StaticText(self, label="Username:")
        username_input = wx.TextCtrl(self, name="username", value=str(self.settings_data.get("username", "")), size=(250, -1))
        # Bind an event to limit the input length
        username_input.Bind(wx.EVT_TEXT, self.on_username_change)

        username_group_sizer = wx.BoxSizer(wx.HORIZONTAL)
        username_group_sizer.Add(username_label, 0, wx.ALL, 5)
        username_group_sizer.Add(username_input, 0, wx.ALL, 5)
        self.sizer.Add(username_group_sizer, 0, wx.ALL | wx.EXPAND, 5)

        counter = 1
        # Create input boxes and labels based on loaded settings
        for ability_name, ability_data in self.settings_data.items():
            if ability_name == "username":
                continue  # Skip the "username" field, as it has a different format

            ability_label = wx.StaticText(self, label=f"Ability {counter}:")
            counter += 1
            #key_label = wx.StaticText(self, label="Key:")
            key_input = wx.TextCtrl(self, name=f"{ability_name}_key", value=ability_data["key"], size=(30, -1))
            key_input.Bind(wx.EVT_TEXT, self.on_key_change)

            #cooldown_label = wx.StaticText(self, label="Cooldown:")
            cooldown_input = wx.TextCtrl(self, name=f"{ability_name}_cooldown", value=str(ability_data["cooldown"]), size=(50, -1))
            cooldown_input.Bind(wx.EVT_TEXT, self.on_cooldown_change)

            # Create a horizontal box sizer for each ability group
            ability_group_sizer = wx.BoxSizer(wx.HORIZONTAL)
            ability_group_sizer.Add(ability_label, 0, wx.ALL, 5)
            #ability_group_sizer.Add(key_label, 0, wx.ALL, 5)
            ability_group_sizer.Add(key_input, 0, wx.ALL, 5)
            #ability_group_sizer.Add(cooldown_label, 0, wx.ALL, 5)
            ability_group_sizer.Add(cooldown_input, 0, wx.ALL, 5)

            # Add the ability group to the main vertical sizer
            self.sizer.Add(ability_group_sizer, 0, wx.ALL | wx.EXPAND, 5)

        self.SetSizer(self.sizer)

        # Set up scrollbars
        self.SetScrollbars(1, 1, 1, 1)
        self.SetScrollRate(10, 10)

    def on_username_change(self, event):
        # Limit the input length to 25 characters
        max_length = 25
        username_input = event.GetEventObject()
        value = username_input.GetValue()
        if len(value) > max_length:
            username_input.SetValue(value[:-1])
            username_input.SetInsertionPointEnd()
        self.on_save(event)

    def on_key_change(self, event):
        # Limit the input length to 25 characters
        max_length = 1
        key_input = event.GetEventObject()
        value = key_input.GetValue()
        if len(value) > max_length:
            key_input.SetValue(value[:-1])
            key_input.SetInsertionPointEnd()
        self.on_save(event)

    def on_cooldown_change(self, event):
        # Limit the input length to 25 characters
        max_length = 5
        cooldown_input = event.GetEventObject()
        value = cooldown_input.GetValue()
        if len(value) > max_length:
            cooldown_input.SetValue(value[:-1])
            cooldown_input.SetInsertionPointEnd()
        self.on_save(event)

    def on_save(self, event):
        # Update the modified values in the original settings data
        for ability_name, ability_data in self.data.items():
            if ability_name == "username":
                username_input = self.FindWindowByName("username")
                new_username = username_input.GetValue()
                if new_username != self.data["username"]:
                    self.data["username"] = new_username
                continue  # Skip the "username" field, as it has a different format

            key_input = self.FindWindowByName(f"{ability_name}_key")
            cooldown_input = self.FindWindowByName(f"{ability_name}_cooldown")

            if key_input and cooldown_input:
                new_key = key_input.GetValue()
                new_cooldown = cooldown_input.GetValue()

                if new_key != ability_data["key"]:
                    self.data[ability_name]["key"] = new_key

                if new_cooldown != str(ability_data["cooldown"]):
                    self.data[ability_name]["cooldown"] = int(new_cooldown)

        # Save only the modified values to the JSON file
        with open("player.json", "w") as file:
            json.dump(self.data, file, indent=4)

    def load_settings(self, filename, keys_of_interest):
        try:
            with open(filename, 'r') as file:
                data = json.load(file)
                filtered_data = {key: data[key] for key in keys_of_interest if key in data}
                return [data, filtered_data]
        except FileNotFoundError:
            print("File not found:", filename)
            return {}

class MyFrame(wx.Frame):
    def __init__(self, *args, **kw):
        super(MyFrame, self).__init__(*args, **kw)

        self.notebook = wx.Notebook(self)

        # Create panels for each menu
        self.lobby_panel = LobbyPanel(self.notebook)
        self.settings_panel = SettingsPanel(self.notebook)

        # Add panels to the notebook with corresponding labels
        self.notebook.AddPage(self.lobby_panel, "Browse")
        self.notebook.AddPage(self.settings_panel, "Settings")

        sizer = wx.BoxSizer(wx.VERTICAL)
        sizer.Add(self.notebook, 1, wx.EXPAND)
        self.SetSizer(sizer)

        self.Center()