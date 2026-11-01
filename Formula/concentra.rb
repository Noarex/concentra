class Concentra < Formula
  desc "Planli odak modu: siteleri ve uygulamalari belirli saatlerde engeller"
  homepage "https://github.com/Noarex/concentra"
  url "https://github.com/Noarex/concentra.git",
      revision: "b72fb0902903af9ae3759912665ac1ed0cd017dc"
  version "1.4.2"
  license "MIT"

  depends_on "bash"
  depends_on "coreutils"
  depends_on "gnu-sed"
  depends_on "jq"
  depends_on :macos

  def install
    # macOS'un bash 3.2'si yerine Homebrew bash'i kullan
    inreplace "odak", %r{\A#!/usr/bin/env bash}, "#!#{Formula["bash"].opt_bin}/bash"
    bin.install "odak"
    bin.install_symlink "odak" => "concentra"
    pkgshare.install "concentra.conf", "eklenti"
    doc.install "README.md"
  end

  def caveats
    <<~EOS
      Kurulumdan (ve her guncellemeden) sonra bir kez calistir:
        sudo odak --kur
      Bu komut /etc/concentra.conf dosyasini ve 30 saniyelik kontrol servisini kurar,
      Brave ayar profilini acar ve YouTube eklentisinin kurulumunu anlatir
      (sonradan tekrar gormek icin: odak eklenti).

      Kaldirmak icin (engelleri, ayarlari ve bu paketi kaldirir):
        sudo odak kaldir
    EOS
  end

  test do
    assert_match "concentra", shell_output("#{bin}/odak surum")
  end
end
