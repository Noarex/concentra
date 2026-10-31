class Concentra < Formula
  desc "Planli odak modu: siteleri ve uygulamalari belirli saatlerde engeller"
  homepage "https://github.com/Noarex/concentra"
  url "https://github.com/Noarex/concentra.git",
      revision: "2a82126ae0c7b509720e2ab0853f824118fd4d45"
  version "1.1.0"
  license "MIT"

  depends_on "bash"
  depends_on "coreutils"
  depends_on "gnu-sed"
  depends_on :macos

  def install
    # macOS'un bash 3.2'si yerine Homebrew bash'i kullan
    inreplace "odak", %r{\A#!/usr/bin/env bash}, "#!#{Formula["bash"].opt_bin}/bash"
    bin.install "odak"
    bin.install_symlink "odak" => "concentra"
    pkgshare.install "concentra.conf"
    doc.install "README.md"
  end

  def caveats
    <<~EOS
      Kurulumdan (ve her guncellemeden) sonra bir kez calistir:
        sudo odak --kur
      Bu komut /etc/concentra.conf dosyasini ve dakikalik kontrol servisini kurar.

      Kaldirmadan once:
        sudo odak --kaldir
    EOS
  end

  test do
    assert_match "concentra", shell_output("#{bin}/odak surum")
  end
end
