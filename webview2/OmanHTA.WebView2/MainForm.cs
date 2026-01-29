using System;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace OmanHTA.WebView2App;

public sealed class MainForm : Form
{
    private readonly WebView2 _webView;
    private string? _appRoot;

    public MainForm()
    {
        Text = "Oman HTA Platform";
        WindowState = FormWindowState.Maximized;
        MinimumSize = new System.Drawing.Size(1200, 720);

        _webView = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(_webView);

        Load += OnLoad;
        _webView.CoreWebView2InitializationCompleted += OnWebViewInitCompleted;
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        _appRoot = FindAppRoot();
        if (_appRoot == null)
        {
            MessageBox.Show(
                "index.html not found. Place this app inside the HTA-oman folder.",
                "Oman HTA Platform",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
            return;
        }

        try
        {
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "OmanHTA",
                "WebView2");
            Directory.CreateDirectory(userDataFolder);

            var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await _webView.EnsureCoreWebView2Async(environment);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"WebView2 failed to initialize.\n\n{ex.Message}\n\nInstall the Microsoft Edge WebView2 Runtime and try again.",
                "Oman HTA Platform",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }
    }

    private void OnWebViewInitCompleted(object? sender, CoreWebView2InitializationCompletedEventArgs e)
    {
        if (!e.IsSuccess || _appRoot == null)
        {
            MessageBox.Show(
                "WebView2 initialization failed.",
                "Oman HTA Platform",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
            return;
        }

        var hostName = "oman-hta.local";
        _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
            hostName,
            _appRoot,
            CoreWebView2HostResourceAccessKind.Allow);

        _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        _webView.CoreWebView2.Settings.AreDevToolsEnabled = System.Diagnostics.Debugger.IsAttached;
        _webView.Source = new Uri($"https://{hostName}/index.html");
    }

    private static string? FindAppRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "index.html");
            if (File.Exists(candidate))
            {
                return dir.FullName;
            }
            dir = dir.Parent;
        }

        return null;
    }
}
