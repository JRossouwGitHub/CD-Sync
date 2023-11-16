import wx
import json

class LobbyPanel(wx.ScrolledWindow):
    def __init__(self, parent):
        super(LobbyPanel, self).__init__(parent, style=wx.VSCROLL)
        self.sizer = wx.BoxSizer(wx.VERTICAL)

        lobby_text = wx.StaticText(self, label="Find and join a lobby:")

        self.sizer.Add(lobby_text, 0, wx.ALL | wx.EXPAND, 5)

        # Create a list to store lobby items
        self.lobby_data = []
        self.lobby_items = []

        # button to create a new lobby
        lobby_label = wx.StaticText(self, label="Lobby Name:")
        lobby_input = wx.TextCtrl(self, name="lobby_name", size=(250, -1))
        lobby_input.Bind(wx.EVT_TEXT, self.on_lobby_name_change)
        create_button = wx.Button(self, name="create_button", label="Create", size=(50, -1))
        create_button.Enable(False)
        create_button.Bind(wx.EVT_BUTTON, self.on_create)
        refresh_button = wx.Button(self, label="Refresh", size=(75, -1))
        refresh_button.Bind(wx.EVT_BUTTON, self.refresh_lobby_list)

        create_lobby_group_sizer = wx.BoxSizer(wx.HORIZONTAL)
        create_lobby_group_sizer.Add(lobby_label, 0, wx.ALL, 5)
        create_lobby_group_sizer.Add(lobby_input, 0, wx.ALL, 5)
        create_lobby_group_sizer.Add(create_button, 0, wx.ALL, 5)
        create_lobby_group_sizer.Add(refresh_button, 0, wx.ALL, 5)
        self.sizer.Add(create_lobby_group_sizer, 0, wx.ALL | wx.EXPAND, 5)

        self.SetSizer(self.sizer)

        self.SetScrollbars(1, 1, 1, 1)
        self.SetScrollRate(10, 10)
    
    def adjust_virtual_size(self):
        self.FitInside()
        self.SetVirtualSize(self.sizer.GetMinSize())

    def add_lobby_item(self, lobby_data):
        lobby_name = lobby_data.get("name", "")
        join_button = wx.Button(self, label="Join", size=(50, -1))
        join_button.Bind(wx.EVT_BUTTON, lambda event, lobby_name=lobby_name: self.on_join(event, lobby_name))

        lobby_item_sizer = wx.BoxSizer(wx.HORIZONTAL)
        lobby_item_sizer.Add(wx.StaticText(self, label=f"{lobby_name}", size=(125, -1)), 0, wx.ALL, 5)
        lobby_item_sizer.Add(join_button, 0, wx.ALL, 5)

        self.lobby_items.append(lobby_item_sizer)
        self.sizer.Add(lobby_item_sizer, 0, wx.ALL | wx.EXPAND, 5)

        # Refresh the layout
        self.Layout()
        self.adjust_virtual_size()

    def on_create(self, event):
        # Add your logic for creating a new lobby
        # For now, let's just add a dummy lobby
        lobby_name = self.FindWindowByName("lobby_name")
        new_lobby_data = {"name": lobby_name.GetValue()}
        self.add_lobby_item(new_lobby_data)
        lobby_name.SetValue("")

    def on_lobby_name_change(self, event):
        # Limit the input length to 25 characters
        max_length = 25
        min_length = 3
        lobby_name_input = event.GetEventObject()
        value = lobby_name_input.GetValue()
        create_button = self.FindWindowByName("create_button")
        if len(value) > max_length:
            lobby_name_input.SetValue(value[:-1])
            lobby_name_input.SetInsertionPointEnd()
        
        if len(value) >= min_length:
            create_button.Enable(True)
        else:
            create_button.Enable(False)

    def on_join(self, event, lobby_name):
        # Add your logic for joining a lobby
        print(f"Joining lobby: {lobby_name}")

    def refresh_lobby_list(self, event):
        # Clear the existing lobby items
        for item in self.lobby_items:
            if(item):
                self.sizer.Hide(item)
                self.sizer.Remove(item)

        self.lobby_items = []

        # Fetch the updated list of lobbies and add them
        lobby_list = self.lobby_data
        for lobby_data_item in lobby_list:
            sizer_item = self.add_lobby_item(lobby_data_item)
            self.lobby_items.append(sizer_item)  # Keep track of sizer items

        # Refresh the layout
        self.Layout()
        self.adjust_virtual_size()

class SettingsPanel(wx.ScrolledWindow):
    def __init__(self, parent):
        super(SettingsPanel, self).__init__(parent, style=wx.VSCROLL)

        self.sizer = wx.BoxSizer(wx.VERTICAL)

        settings_text = wx.StaticText(self, label="Update your settings:")
        self.sizer.Add(settings_text, 0, wx.ALL | wx.EXPAND, 5)

        # Load settings from JSON file and filter out specific keys
        json_data = self.load_settings("player.json")
        self.settings_data = json_data

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
        for ability_name, ability_data in self.settings_data.items():
            if ability_name == "username":
                username_input = self.FindWindowByName("username")
                new_username = username_input.GetValue()
                if new_username != self.settings_data["username"]:
                    self.settings_data["username"] = new_username
                continue  # Skip the "username" field, as it has a different format

            key_input = self.FindWindowByName(f"{ability_name}_key")
            cooldown_input = self.FindWindowByName(f"{ability_name}_cooldown")

            if key_input and cooldown_input:
                new_key = key_input.GetValue()
                new_cooldown = cooldown_input.GetValue()

                if new_key != ability_data["key"]:
                    self.settings_data[ability_name]["key"] = new_key

                if new_cooldown != str(ability_data["cooldown"]):
                    self.settings_data[ability_name]["cooldown"] = int(new_cooldown)

        # Save only the modified values to the JSON file
        with open("player.json", "w") as file:
            json.dump(self.settings_data, file, indent=4)

    def load_settings(self, filename):
        try:
            with open(filename, 'r') as file:
                data = json.load(file)
                return data
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

    def on_exit(self, event):
        # Add your cleanup logic here
        self.Destroy()  # Properly destroy the frame