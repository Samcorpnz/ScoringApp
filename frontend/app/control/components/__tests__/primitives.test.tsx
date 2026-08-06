import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { LogoUploadCard } from "../primitives";

afterEach(cleanup);

function makeFile(name = "logo.png") {
  return new File(["fake"], name, { type: "image/png" });
}

describe("LogoUploadCard", () => {
  it("renders the empty drop-zone prompt and Upload Logo label when logoSrc is null", () => {
    render(
      <LogoUploadCard
        testId="t"
        logoSrc={null}
        alt="Team logo"
        onUpload={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText("Click or drag to upload")).toBeInTheDocument();
    expect(screen.getByTestId("t-upload-button")).toHaveTextContent("Upload Logo");
    expect(screen.queryByTestId("t-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("t-remove-button")).not.toBeInTheDocument();
  });

  it("renders the image preview and Replace Logo label when logoSrc is set", () => {
    render(
      <LogoUploadCard
        testId="t"
        logoSrc="https://example.com/logo.png"
        alt="Team logo"
        onUpload={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByTestId("t-preview")).toBeInTheDocument();
    expect(screen.getByTestId("t-upload-button")).toHaveTextContent("Replace Logo");
    expect(screen.getByTestId("t-remove-button")).toBeInTheDocument();
  });

  it("calls onUpload with the selected file when a file is chosen via the input", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(
      <LogoUploadCard testId="t" logoSrc={null} alt="Team logo" onUpload={onUpload} onRemove={vi.fn()} />
    );
    const file = makeFile();
    const input = screen.getByTestId("t-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
  });

  it("calls onUpload with the dropped file", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(
      <LogoUploadCard testId="t" logoSrc={null} alt="Team logo" onUpload={onUpload} onRemove={vi.fn()} />
    );
    const file = makeFile("dropped.png");
    const dropZone = screen.getByTestId("t-input").previousSibling as HTMLElement;
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
  });

  it("shows an error message when onUpload rejects", async () => {
    const onUpload = vi.fn().mockRejectedValue(new Error("upload failed"));
    render(
      <LogoUploadCard testId="t" logoSrc={null} alt="Team logo" onUpload={onUpload} onRemove={vi.fn()} />
    );
    const input = screen.getByTestId("t-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile()] } });
    await waitFor(() => expect(screen.getByTestId("t-error")).toHaveTextContent("upload failed"));
  });

  it("calls onRemove when the remove button is clicked", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(
      <LogoUploadCard
        testId="t"
        logoSrc="https://example.com/logo.png"
        alt="Team logo"
        onUpload={vi.fn()}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByTestId("t-remove-button"));
    await waitFor(() => expect(onRemove).toHaveBeenCalled());
  });

  it("disables the upload button while uploading is in flight", async () => {
    let resolveUpload: () => void = () => {};
    const onUpload = vi.fn(
      () => new Promise<void>(resolve => { resolveUpload = resolve; })
    );
    render(
      <LogoUploadCard testId="t" logoSrc={null} alt="Team logo" onUpload={onUpload} onRemove={vi.fn()} />
    );
    const input = screen.getByTestId("t-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile()] } });
    await waitFor(() => expect(screen.getByTestId("t-upload-button")).toBeDisabled());
    resolveUpload();
    await waitFor(() => expect(screen.getByTestId("t-upload-button")).not.toBeDisabled());
  });
});
