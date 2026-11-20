// install.exe: runs the install.ps1 baked into it
// build on windows: C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /out:install.exe /resource:install.ps1 install.cs
using System.Diagnostics;
using System.IO;
using System.Reflection;

class Install {
	static int Main() {
		var ps1 = Path.Combine(Path.GetTempPath(), "rinthify-install.ps1");
		using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("install.ps1"))
		using (var f = File.Create(ps1)) s.CopyTo(f);
		var p = Process.Start(new ProcessStartInfo("powershell", "-NoProfile -ExecutionPolicy Bypass -File \"" + ps1 + "\"") { UseShellExecute = false });
		p.WaitForExit();
		return p.ExitCode;
	}
}
